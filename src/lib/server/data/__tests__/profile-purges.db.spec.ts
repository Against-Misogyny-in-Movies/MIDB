import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { commentReports, communityContentReports, comments } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import {
	purgeCalls,
	resetCloudflareStub,
	waitUntilPromises
} from '#test/cloudflare-workers.stub.ts';
import { REPORT_THRESHOLD } from '#lib/media/utils/comments.ts';
import { reportComment } from '#lib/server/data/comment-reports.ts';
import {
	approveComment,
	banAccount,
	dismissReports,
	hideComment,
	muteUser,
	rejectComment,
	restoreComment
} from '#lib/server/data/moderation-actions.ts';
import {
	approveReport,
	rejectAccountReports,
	rejectReport
} from '#lib/server/data/community-report-moderation.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';

let mod: UserRow;
let titleId: string;

/** The profile tags purged so far, after the `waitUntil` work has run. */
async function profilePurges(): Promise<string[]> {
	await Promise.all(waitUntilPromises);
	return purgeCalls.flatMap((c) => c.tags ?? []).filter((t) => t.startsWith('profile:'));
}

beforeEach(async () => {
	resetCloudflareStub();
	const old = new Date(Date.now() - 100 * 86_400_000);
	await db
		.insert(users)
		.values([
			userValues('author', { username: 'author', createdAt: old, updatedAt: old }),
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

const comment = async (status: (typeof comments.$inferInsert)['status']) => {
	const [row] = await db
		.insert(comments)
		.values({ titleId, userId: 'author', body: 'Text', status })
		.returning();
	return row.id;
};

describe('a moderator action on a comment names the author for the profile purge', () => {
	it.each([
		['approve', 'pending', approveComment],
		['hide', 'published', (a: UserRow, id: string) => hideComment(a, id, null)],
		['reject', 'published', (a: UserRow, id: string) => rejectComment(a, id, null)],
		['restore', 'hidden', restoreComment]
	] as const)('%s', async (_name, from, act) => {
		const id = await comment(from);
		expect(await act(mod, id)).toMatchObject({ ok: true, authorId: 'author' });
	});

	it('a refused action names no author', async () => {
		const id = await comment('hidden');
		expect(await approveComment(mod, id)).toEqual({ ok: false, reason: 'invalid-state' });
	});

	it('a dismiss names the author only when it puts the comment back in public', async () => {
		const sent = await comment('pending');
		await db.update(comments).set({ moderationSource: 'reports' }).where(eq(comments.id, sent));
		await db.insert(commentReports).values({ commentId: sent, reporterId: 'rep0', reason: 'spam' });
		expect(await dismissReports(mod, sent)).toMatchObject({ ok: true, authorId: 'author' });

		const live = await comment('published');
		await db.insert(commentReports).values({ commentId: live, reporterId: 'rep0', reason: 'spam' });
		const result = await dismissReports(mod, live);
		expect(result.ok && result.authorId).toBeFalsy();
	});

	it('a reader report that sends the comment to review names the author', async () => {
		const id = await comment('published');
		let last;
		for (let i = 0; i < REPORT_THRESHOLD; i++) {
			last = await reportComment({ commentId: id, reporterId: `rep${i}`, reason: 'spam' });
		}
		expect(last).toMatchObject({ ok: true, status: 'pending', authorId: 'author' });
	});
});

describe('purging the profile', () => {
	it('a ban purges it, a mute too (its reports stop counting)', async () => {
		await banAccount(mod, 'author', null);
		expect(await profilePurges()).toEqual(['profile:author']);
		resetCloudflareStub();
		await db.update(users).set({ bannedAt: null }).where(eq(users.id, 'author'));
		await muteUser(mod, 'author', 24, null);
		expect(await profilePurges()).toEqual(['profile:author']);
	});

	it('a refused ban purges nothing', async () => {
		await banAccount(mod, 'mod', null);
		expect(await profilePurges()).toEqual([]);
	});

	it('moving a community report purges the reporter’s profile, a refused move does not', async () => {
		await db.insert(communityContentReports).values({ userId: 'author', titleId, status: 'held' });
		expect(await approveReport(mod, 'author', titleId)).toMatchObject({ ok: true });
		expect(await profilePurges()).toEqual(['profile:author']);
		resetCloudflareStub();
		expect(await rejectReport(mod, 'author', titleId)).toMatchObject({ ok: true });
		expect(await profilePurges()).toEqual(['profile:author']);
		resetCloudflareStub();
		expect(await rejectReport(mod, 'author', titleId)).toMatchObject({ ok: false });
		expect(await profilePurges()).toEqual([]);
	});

	it('rejecting every report of an account purges its profile once', async () => {
		await db
			.insert(communityContentReports)
			.values({ userId: 'author', titleId, status: 'counted' });
		expect(await rejectAccountReports(mod, 'author')).toMatchObject({ ok: true });
		expect(await profilePurges()).toEqual(['profile:author']);
	});
});
