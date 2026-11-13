import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { comments } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { REPORT_THRESHOLD } from '#lib/media/utils/comments.ts';
import { editComment, softDeleteComment } from '#lib/server/data/comment-queries.ts';
import { replyAuthorsAffected } from '#lib/server/data/comment-reply-authors.ts';
import { reportComment } from '#lib/server/data/comment-reports.ts';
import {
	approveComment,
	hideComment,
	rejectComment,
	restoreComment
} from '#lib/server/data/moderation-actions.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';

let mod: UserRow;
let titleId: string;

beforeEach(async () => {
	await db
		.insert(users)
		.values([
			userValues('author'),
			userValues('bea'),
			userValues('carl'),
			...Array.from({ length: REPORT_THRESHOLD }, (_, i) => userValues(`rep${i}`)),
			userValues('mod', { role: 'moderator' })
		]);
	[mod] = await db.select().from(users).where(eq(users.id, 'mod'));
	const [title] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
	titleId = title.id;
});

const add = async (
	userId: string,
	status: (typeof comments.$inferInsert)['status'],
	parentId?: string
) => {
	const [row] = await db
		.insert(comments)
		.values({ titleId, userId, body: 'Text', status, parentId })
		.returning();
	return row.id;
};

/** A parent with a published reply by bea (twice), and a hidden one by carl. */
async function thread(status: (typeof comments.$inferInsert)['status']) {
	const parent = await add('author', status);
	await add('bea', 'published', parent);
	await add('bea', 'published', parent);
	await add('carl', 'hidden', parent);
	return parent;
}

describe('replyAuthorsAffected', () => {
	it('names the distinct authors of published direct replies when the status enters or leaves published', async () => {
		const parent = await thread('published');
		expect(await replyAuthorsAffected(parent, 'published', 'hidden')).toEqual(['bea']);
		expect(await replyAuthorsAffected(parent, 'pending', 'published')).toEqual(['bea']);
	});

	it('names no one for a move that does not touch published, and reads nothing for it', async () => {
		const parent = await thread('published');
		expect(await replyAuthorsAffected(parent, 'pending', 'hidden')).toEqual([]);
		expect(await replyAuthorsAffected(parent, 'published', 'published')).toEqual([]);
	});

	it('names no one for a comment with no published replies', async () => {
		const lone = await add('author', 'published');
		expect(await replyAuthorsAffected(lone, 'published', 'deleted')).toEqual([]);
	});
});

describe('a comment leaving published names the authors of its published replies', () => {
	it.each([
		['hide', (id: string) => hideComment(mod, id, null)],
		['reject', (id: string) => rejectComment(mod, id, null)]
	] as const)('%s', async (_name, act) => {
		const parent = await thread('published');
		expect(await act(parent)).toMatchObject({
			ok: true,
			authorId: 'author',
			replyAuthorIds: ['bea']
		});
	});

	it('restore and approve name them too, since "In reply to" returns', async () => {
		const hidden = await thread('hidden');
		expect(await restoreComment(mod, hidden)).toMatchObject({ replyAuthorIds: ['bea'] });
		const pending = await thread('pending');
		expect(await approveComment(mod, pending)).toMatchObject({ replyAuthorIds: ['bea'] });
	});

	it('the author’s delete', async () => {
		const parent = await thread('published');
		expect(await softDeleteComment(parent, 'author')).toMatchObject({
			ok: true,
			replyAuthorIds: ['bea']
		});
	});

	it('a reader report that sends it to review, and not one that leaves it published', async () => {
		const parent = await thread('published');
		const results = [];
		for (let i = 0; i < REPORT_THRESHOLD; i++) {
			results.push(
				await reportComment({ commentId: parent, reporterId: `rep${i}`, reason: 'spam' })
			);
		}
		expect(results[0]).toMatchObject({ ok: true, status: 'published', replyAuthorIds: [] });
		expect(results[REPORT_THRESHOLD - 1]).toMatchObject({
			ok: true,
			status: 'pending',
			replyAuthorIds: ['bea']
		});
	});

	it('an edit that sends it back to review', async () => {
		const parent = await thread('published');
		const result = await editComment(parent, 'author', 'Changed text');
		expect(result).toMatchObject({
			ok: true,
			comment: { status: 'pending' },
			replyAuthorIds: ['bea']
		});
	});
});
