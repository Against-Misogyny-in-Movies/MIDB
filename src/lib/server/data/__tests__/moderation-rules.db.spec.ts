import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { comments, moderationActions } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import type * as DecideModule from '#lib/server/moderation/decide.ts';
import { runBulk } from '#lib/server/moderation/bulk.ts';
import { editComment } from '../comment-queries.ts';
import {
	approveComment,
	banAccount,
	hideComment,
	muteUser,
	rejectComment,
	restoreComment
} from '../moderation-actions.ts';
import { scrubAccount } from '../account-scrub.ts';
import { getUserComments, getUserById, type UserRow } from '../user-queries.ts';
import { buildAccountExport } from '../account-export.ts';

const decided: { next: Awaited<ReturnType<typeof DecideModule.decideStatus>> | null } = {
	next: null
};
vi.mock('#lib/server/moderation/decide.ts', async (importOriginal) => {
	const original = await importOriginal<typeof DecideModule>();
	return {
		...original,
		decideStatus: async (...args: Parameters<typeof original.decideStatus>) =>
			decided.next ?? original.decideStatus(...args)
	};
});

let mod: UserRow;
let titleId: string;

beforeEach(async () => {
	decided.next = null;
	await db
		.insert(users)
		.values([
			userValues('mod', { role: 'moderator', username: 'mod_one' }),
			userValues('author', { username: 'author_one' }),
			userValues('other')
		]);
	mod = (await getUserById('mod'))!;
	[{ id: titleId }] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
});

async function comment(id: string, status: 'published' | 'pending' | 'rejected' | 'hidden') {
	await db.insert(comments).values({ id, titleId, userId: 'author', body: `text ${id}`, status });
	return id;
}
const stored = async (id: string) =>
	(await db.select().from(comments).where(eq(comments.id, id)))[0];
const log = async (action: 'hide' | 'reject' | 'mute' | 'ban') =>
	(await db.select().from(moderationActions).where(eq(moderationActions.action, action)))[0];

describe('the rule of a decision', () => {
	it('is stored with a hide, with the note beside it, and logged', async () => {
		await comment('c1', 'published');
		await hideComment(mod, 'c1', 'Twice today', 'spam');
		expect(await stored('c1')).toMatchObject({
			status: 'hidden',
			moderationSource: 'moderator',
			moderationReason: 'Twice today',
			moderationRule: 'spam'
		});
		expect(await log('hide')).toMatchObject({ reason: 'Twice today', rule: 'spam' });
	});

	it('is stored with a reject, and the author reads it', async () => {
		await comment('c1', 'pending');
		await rejectComment(mod, 'c1', null, 'harassment');
		expect(await stored('c1')).toMatchObject({ status: 'rejected', moderationRule: 'harassment' });
		expect(await log('reject')).toMatchObject({ reason: null, rule: 'harassment' });
		const [mine] = await getUserComments('author', { notPublic: true });
		expect(mine).toMatchObject({ moderationRule: 'harassment' });
	});

	it('is stored on the log row of a mute and a ban', async () => {
		await muteUser(mod, 'author', 24, 'cooling off', 'trolling');
		expect(await log('mute')).toMatchObject({
			rule: 'trolling',
			reason: 'cooling off',
			muteHours: 24
		});
		const admin = { ...mod, id: 'adm', role: 'administrator' } as UserRow;
		await db.insert(users).values(userValues('adm', { role: 'administrator' }));
		await banAccount(admin, 'other', 'abuse', 'hate');
		expect(await log('ban')).toMatchObject({ rule: 'hate', reason: 'abuse' });
	});

	it('stays null when no rule is given, as the other callers leave it', async () => {
		await comment('c1', 'published');
		await hideComment(mod, 'c1', 'x');
		expect((await stored('c1')).moderationRule).toBeNull();
		expect((await log('hide')).rule).toBeNull();
	});

	it('is cleared when the comment is restored or approved', async () => {
		await comment('c1', 'published');
		await rejectComment(mod, 'c1', 'x', 'violence');
		await restoreComment(mod, 'c1', null);
		expect(await stored('c1')).toMatchObject({ status: 'published', moderationRule: null });
		await comment('c2', 'pending');
		await db.update(comments).set({ moderationRule: 'spam' }).where(eq(comments.id, 'c2'));
		await approveComment(mod, 'c2', null);
		expect((await stored('c2')).moderationRule).toBeNull();
	});

	it('is cleared when the author’s edit gets an automatic decision', async () => {
		await db.insert(comments).values({
			id: 'c1',
			titleId,
			userId: 'author',
			body: 'old',
			status: 'rejected',
			moderationSource: 'ai',
			moderationReason: 'Attacks a person.',
			moderationRule: 'harassment'
		});
		decided.next = { status: 'rejected', source: 'ai', reason: 'Still attacks.', aiVerdict: null };
		const result = await editComment('c1', 'author', 'new');
		expect(result.ok).toBe(true);
		expect(await stored('c1')).toMatchObject({
			moderationReason: 'Still attacks.',
			moderationRule: null
		});
	});

	it('is stored by the bulk operation for each comment', async () => {
		await comment('c1', 'published');
		await comment('c2', 'pending');
		const data = new FormData();
		data.set('op', 'reject');
		data.set('rule', 'threat');
		data.set('reason', 'Menacing');
		data.append('ids', 'c1');
		data.append('ids', 'c2');
		expect(await runBulk(mod, data)).toMatchObject({ ok: true, extra: { applied: 2 } });
		expect(await stored('c1')).toMatchObject({
			moderationRule: 'threat',
			moderationReason: 'Menacing'
		});
		expect((await stored('c2')).moderationRule).toBe('threat');
		expect(await db.select().from(moderationActions)).toHaveLength(2);
		const noRule = new FormData();
		noRule.set('op', 'hide');
		noRule.append('ids', 'c1');
		expect(await runBulk(mod, noRule)).toEqual({ ok: false, reason: 'invalid' });
	});

	it('is removed with the rest of a deleted account’s moderation notes, and is in the data download', async () => {
		await comment('c1', 'published');
		await rejectComment(mod, 'c1', 'x', 'spam');
		const author = (await getUserById('author'))!;
		const download = await buildAccountExport(author, new Date());
		expect(download.comments[0]).toMatchObject({ moderationRule: 'spam' });
		await db.insert(comments).values({
			id: 'r1',
			titleId,
			userId: 'other',
			body: 'reply',
			status: 'published',
			parentId: 'c1',
			rootId: 'c1'
		});
		await scrubAccount('author');
		const [after] = await db.select().from(comments).where(eq(comments.id, 'c1'));
		expect(after).toMatchObject({ status: 'deleted', moderationRule: null });
	});
});
