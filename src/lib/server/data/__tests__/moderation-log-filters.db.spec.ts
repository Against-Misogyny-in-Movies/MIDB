import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { comments, moderationActions } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { LOG_ACTION_GROUPS, logActionsOf } from '#lib/media/utils/moderationLog.ts';
import { accountIdByUsername } from '../account-view.ts';
import { listRecentActions } from '../moderation-queue.ts';
import { banAccount, hideComment, muteUser, restoreComment } from '../moderation-actions.ts';
import { unbanAccount, unmuteUser } from '../moderation-reversals.ts';
import { getUserById, type UserRow } from '../user-queries.ts';

const T0 = Date.UTC(2026, 10, 1);
let mod: UserRow;
let admin: UserRow;
let titleId: string;

beforeEach(async () => {
	await db
		.insert(users)
		.values([
			userValues('mod', { role: 'moderator', username: 'Mod_One' }),
			userValues('admin', { role: 'administrator', username: 'admin_one' }),
			userValues('a', { username: 'anna' }),
			userValues('b', { username: 'bo' })
		]);
	mod = (await getUserById('mod'))!;
	admin = (await getUserById('admin'))!;
	[{ id: titleId }] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
});

const log = (id: string, action: (typeof moderationActions.$inferInsert)['action'], over = {}) =>
	db.insert(moderationActions).values({ id, actorId: 'mod', action, ...over });
const ids = async (filter: Parameters<typeof listRecentActions>[2]) =>
	(await listRecentActions(null, undefined, filter)).items.map((i) => i.id).sort();

describe('the log’s filters', () => {
	beforeEach(async () => {
		await db
			.insert(comments)
			.values({ id: 'c1', titleId, userId: 'a', body: 'x', status: 'hidden' });
		await log('hide-a', 'hide', { targetCommentId: 'c1' });
		await log('mute-a', 'mute', { targetUserId: 'a', muteHours: 24 });
		await log('mute-b', 'mute', { targetUserId: 'b', muteHours: 24 });
		await log('ban-b', 'ban', { targetUserId: 'b', actorId: 'admin' });
		await log('note-a', 'note', { targetUserId: 'a', actorId: 'admin' });
		await log('role-b', 'set_role', { targetUserId: 'b', actorId: 'admin', reason: 'moderator' });
	});

	it('is the whole log with no filter', async () => {
		expect(await ids({})).toHaveLength(6);
	});

	it('filters by one action', async () => {
		expect(await ids({ actions: ['mute'] })).toEqual(['mute-a', 'mute-b']);
	});

	it('filters by each group, which together cover the whole log', async () => {
		const seen = new Set<string>();
		for (const group of LOG_ACTION_GROUPS) {
			for (const id of await ids({ actions: logActionsOf(group.id)! })) seen.add(id);
		}
		expect(seen.size).toBe(6);
		expect(await ids({ actions: logActionsOf('restrictions')! })).toEqual([
			'ban-b',
			'mute-a',
			'mute-b'
		]);
		expect(await ids({ actions: logActionsOf('roles')! })).toEqual(['note-a', 'role-b']);
		expect(await ids({ actions: logActionsOf('comments')! })).toEqual(['hide-a']);
	});

	it('filters by the staff member', async () => {
		expect(await ids({ actorId: 'admin' })).toEqual(['ban-b', 'note-a', 'role-b']);
		expect(await ids({ actorId: 'nobody' })).toEqual([]);
	});

	it('filters by the account, comment actions on its comments included', async () => {
		expect(await ids({ accountId: 'a' })).toEqual(['hide-a', 'mute-a', 'note-a']);
		expect(await ids({ accountId: 'b' })).toEqual(['ban-b', 'mute-b', 'role-b']);
	});

	it('combines the filters', async () => {
		expect(await ids({ accountId: 'b', actorId: 'admin' })).toEqual(['ban-b', 'role-b']);
		expect(await ids({ accountId: 'b', actorId: 'admin', actions: ['ban'] })).toEqual(['ban-b']);
		expect(await ids({ accountId: 'a', actions: ['ban'] })).toEqual([]);
	});

	it('pages under a filter with the log’s cursor, newest first, each row once', async () => {
		await db.insert(moderationActions).values(
			Array.from({ length: 8 }, (_, i) => ({
				id: `more${i}`,
				actorId: 'mod',
				targetUserId: 'b',
				action: 'mute' as const,
				muteHours: 24,
				createdAt: new Date(T0 + (i % 3) * 1000)
			}))
		);
		const seen: string[] = [];
		let cursor: string | null = null;
		let pages = 0;
		do {
			const page = await listRecentActions(cursor, 4, { accountId: 'b', actions: ['mute'] });
			seen.push(...page.items.map((i) => i.id));
			cursor = page.nextCursor;
			pages++;
		} while (cursor);
		expect(pages).toBe(3);
		expect(new Set(seen).size).toBe(9);
		expect(seen).toContain('mute-b');
		expect(seen).not.toContain('mute-a');
	});
});

describe('accountIdByUsername', () => {
	it('finds an account by username in any case, and no one else', async () => {
		expect(await accountIdByUsername('MOD_one')).toBe('mod');
		expect(await accountIdByUsername('anna')).toBe('a');
		expect(await accountIdByUsername('nobody')).toBeNull();
	});

	it('does not find a deleted account, which has no username', async () => {
		await db.update(users).set({ username: null }).where(eq(users.id, 'a'));
		expect(await accountIdByUsername('anna')).toBeNull();
	});
});

describe('the action a reversal undoes', () => {
	const row = async (action: string) =>
		(await listRecentActions()).items.find((i) => i.action === action)!;

	it('names the mute an End mute ended, with its actor and day', async () => {
		await muteUser(mod, 'a', 24, null);
		await unmuteUser(admin, 'a', null);
		expect((await row('unmute')).reverses).toMatchObject({ action: 'mute', actor: 'Mod_One' });
		expect((await row('mute')).reverses).toBeNull();
	});

	it('names the ban a Lift ban lifted', async () => {
		await banAccount(admin, 'b', null);
		await unbanAccount(admin, 'b', null);
		expect((await row('unban')).reverses).toMatchObject({ action: 'ban', actor: 'admin_one' });
	});

	it('names the hide a Restore undid, and the latest of several', async () => {
		await db.insert(comments).values({ id: 'c1', titleId, userId: 'a', body: 'x' });
		await hideComment(mod, 'c1', null, 'spam');
		await new Promise((r) => setTimeout(r, 5));
		await restoreComment(admin, 'c1', null);
		await new Promise((r) => setTimeout(r, 5));
		await hideComment(admin, 'c1', null, 'spam');
		await restoreComment(admin, 'c1', null);
		const restores = (await listRecentActions()).items.filter((i) => i.action === 'restore');
		expect(restores).toHaveLength(2);
		expect(restores[0].reverses).toMatchObject({ action: 'hide', actor: 'admin_one' });
		expect(restores[1].reverses).toMatchObject({ action: 'hide', actor: 'Mod_One' });
	});

	it('names the closed flag a Re-open re-opened, by account and title', async () => {
		await log('close', 'resolve_count_flag', { targetUserId: 'a', targetTitleId: titleId });
		await log('other', 'dismiss_count_flag', { targetUserId: 'b', targetTitleId: titleId });
		await new Promise((r) => setTimeout(r, 5));
		await log('reopen', 'reopen_flag', { targetUserId: 'a', targetTitleId: titleId });
		const item = (await listRecentActions()).items.find((i) => i.id === 'reopen')!;
		expect(item.reverses).toMatchObject({ action: 'resolve_count_flag' });
	});

	it('says nothing for a reversal with no earlier action logged, or only a later one', async () => {
		await log('un', 'unmute', { targetUserId: 'a' });
		await log('later', 'mute', { targetUserId: 'a', createdAt: new Date(Date.now() + 10_000) });
		expect((await listRecentActions()).items.find((i) => i.id === 'un')!.reverses).toBeNull();
	});
});
