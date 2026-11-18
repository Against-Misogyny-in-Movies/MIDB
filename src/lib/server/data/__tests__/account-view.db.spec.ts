import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import {
	commentReports,
	comments,
	communityContentReports,
	moderationActions
} from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import {
	ACCOUNT_LIST_LIMIT,
	listAccountComments,
	listAccountReports,
	listReportsAgainst
} from '../account-lists.ts';
import { getAccountView } from '../account-view.ts';
import { banAccount, hideComment, muteUser } from '../moderation-actions.ts';
import { listRecentActions } from '../recent-actions.ts';
import { getUserById, type UserRow } from '../user-queries.ts';

const T0 = Date.UTC(2026, 10, 1);
let mod: UserRow;
let admin: UserRow;
let titleId: string;

beforeEach(async () => {
	await db
		.insert(users)
		.values([
			userValues('mod', { role: 'moderator', username: 'mod_one' }),
			userValues('admin', { role: 'administrator', username: 'admin_one' }),
			userValues('target', { username: 'target_1', avatarKey: 'curie', createdAt: new Date(T0) }),
			userValues('rep', { username: 'rep_1' }),
			userValues('other', { username: 'other_1' })
		]);
	mod = (await getUserById('mod'))!;
	admin = (await getUserById('admin'))!;
	[{ id: titleId }] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
});

const comment = (
	id: string,
	status: (typeof comments.$inferInsert)['status'],
	at = 0,
	userId = 'target'
) =>
	db.insert(comments).values({
		id,
		titleId,
		userId,
		body: `Body ${id}`,
		status,
		createdAt: new Date(T0 + at),
		updatedAt: new Date(T0 + at)
	});

describe('getAccountView', () => {
	it('is null for an unknown id', async () => {
		expect(await getAccountView('nobody')).toBeNull();
	});

	it('reads the account as a public user with its join day and no standing', async () => {
		const view = await getAccountView('target');
		expect(view).toMatchObject({
			user: { id: 'target', username: 'target_1', displayName: 'target_1', role: 'user' },
			joinedAt: new Date(T0).toISOString(),
			deleted: false,
			mutedUntil: null,
			banned: null
		});
		expect(JSON.stringify(view)).not.toContain('@example.com');
	});

	it('counts the figures as totals: comments, hidden or rejected, reports against and community reports', async () => {
		await comment('c1', 'published');
		await comment('c2', 'hidden');
		await comment('c3', 'rejected');
		await comment('c4', 'pending');
		await comment('other-c', 'published', 0, 'other');
		await db.insert(commentReports).values([
			{ commentId: 'c1', reporterId: 'rep', reason: 'spam' },
			{ commentId: 'c4', reporterId: 'rep', reason: 'hate' },
			{ commentId: 'c2', reporterId: 'rep', reason: 'hate', status: 'resolved' },
			{ commentId: 'other-c', reporterId: 'rep', reason: 'spam' }
		]);
		await db.insert(communityContentReports).values({ userId: 'target', titleId, status: 'held' });
		const view = await getAccountView('target');
		expect(view?.figures).toEqual({
			comments: 4,
			hiddenOrRejected: 2,
			openReportsAgainst: 2,
			communityReports: 1,
			communityReportsLive: 1,
			reportsMade: { total: 0, upheld: 0, dismissed: 0 }
		});
	});

	it('counts the reports the account made with how many were upheld', async () => {
		await comment('o1', 'hidden', 0, 'other');
		await comment('o2', 'published', 0, 'other');
		await db.insert(commentReports).values([
			{ commentId: 'o1', reporterId: 'target', reason: 'spam', status: 'resolved' },
			{ commentId: 'o2', reporterId: 'target', reason: 'spam', status: 'dismissed' }
		]);
		expect((await getAccountView('target'))?.figures?.reportsMade).toEqual({
			total: 2,
			upheld: 1,
			dismissed: 1
		});
	});

	it('leaves rejected community reports out of the count that Reject all would cover', async () => {
		await db
			.insert(communityContentReports)
			.values({ userId: 'target', titleId, status: 'rejected' });
		const figures = (await getAccountView('target'))?.figures;
		expect(figures).toMatchObject({ communityReports: 1, communityReportsLive: 0 });
	});

	it('shows a mute with who set it, and a ban with its reason and day', async () => {
		await muteUser(mod, 'target', 24, 'rude');
		let view = await getAccountView('target');
		expect(view?.mutedUntil).not.toBeNull();
		expect(view?.mutedByModerator).toBe(true);
		await muteUser(admin, 'target', 48, null);
		view = await getAccountView('target');
		expect(view?.mutedByModerator).toBe(false);
		await banAccount(admin, 'target', 'spam ring');
		view = await getAccountView('target');
		expect(view?.banned).toMatchObject({ reason: 'spam ring' });
		expect(view?.banned?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it('reads a deleted account as scrubbed: no figures, no name', async () => {
		await db
			.update(users)
			.set({ deletedAt: new Date(), username: null, avatarKey: null })
			.where(eq(users.id, 'target'));
		const view = await getAccountView('target');
		expect(view).toMatchObject({ deleted: true, figures: null });
		expect(view?.user.displayName).toBe('Account');
	});
});

describe('the lists on an account’s page', () => {
	it('lists the account’s comments in every status, newest first, and no one else’s', async () => {
		await comment('c1', 'published', 1000);
		await comment('c2', 'hidden', 3000);
		await comment('c3', 'deleted', 2000);
		await comment('other-c', 'published', 4000, 'other');
		const rows = await listAccountComments('target');
		expect(rows.map((r) => [r.id, r.status])).toEqual([
			['c2', 'hidden'],
			['c3', 'deleted'],
			['c1', 'published']
		]);
		expect(rows[0].title).toEqual({ kind: 'movie', tmdbId: 348, name: 'Alien' });
	});

	it('stops the comments at the list limit', async () => {
		const rows = Array.from({ length: ACCOUNT_LIST_LIMIT + 3 }, (_, i) => ({
			id: `c${String(i).padStart(3, '0')}`,
			titleId,
			userId: 'target',
			body: 'x',
			createdAt: new Date(T0 + i)
		}));
		for (const chunk of chunkForD1(rows, 16)) await db.insert(comments).values(chunk);
		expect(await listAccountComments('target')).toHaveLength(ACCOUNT_LIST_LIMIT);
	});

	it('lists community reports in every status with what their standing reads from', async () => {
		await db.insert(communityContentReports).values({ userId: 'target', titleId, status: 'held' });
		const [row] = await listAccountReports('target');
		expect(row).toMatchObject({ titleId, status: 'held', title: 'Alien', restricted: null });
		expect(row.countsFrom).toMatch(/^\d{4}-/);
	});

	it('lists the open reports against its comments with each reporter’s record, and no closed one', async () => {
		await comment('c1', 'published', 2000);
		await comment('c2', 'published', 1000);
		await comment('o1', 'hidden', 0, 'other');
		await db.insert(commentReports).values([
			{
				commentId: 'c1',
				reporterId: 'rep',
				reason: 'harassment',
				note: 'rude',
				createdAt: new Date(T0 + 5)
			},
			{ commentId: 'c2', reporterId: 'rep', reason: 'spam', status: 'dismissed' },
			{ commentId: 'o1', reporterId: 'rep', reason: 'spam', status: 'resolved' }
		]);
		const against = await listReportsAgainst('target');
		expect(against).toHaveLength(1);
		expect(against[0]).toMatchObject({
			reason: 'harassment',
			note: 'rude',
			reporter: 'rep_1',
			reporterId: 'rep',
			record: { total: 3, upheld: 1, dismissed: 1 },
			comment: { id: 'c1', status: 'published' }
		});
	});
});

describe('the log of one account', () => {
	it('holds the actions that name the account and those on its comments, and no others', async () => {
		await comment('c1', 'published');
		await comment('other-c', 'published', 0, 'other');
		await muteUser(mod, 'target', 24, null);
		await hideComment(mod, 'c1', null, 'spam');
		await muteUser(mod, 'other', 24, null);
		await hideComment(mod, 'other-c', null, 'spam');
		const { items } = await listRecentActions(null, undefined, { accountId: 'target' });
		expect(items.map((i) => i.action).sort()).toEqual(['hide', 'mute']);
		expect(items.every((i) => i.targetUser?.id === 'target' || i.commentId === 'c1')).toBe(true);
	});

	it('pages under the filter with the log’s cursor, newest first, no row twice', async () => {
		await comment('c1', 'published');
		await db.insert(moderationActions).values(
			Array.from({ length: 7 }, (_, i) => ({
				id: `a${i}`,
				actorId: 'mod',
				targetUserId: i % 2 === 0 ? 'target' : null,
				targetCommentId: i % 2 === 0 ? null : 'c1',
				action: i % 2 === 0 ? ('mute' as const) : ('hide' as const),
				createdAt: new Date(T0 + (i % 3) * 1000)
			}))
		);
		await db.insert(moderationActions).values({
			id: 'elsewhere',
			actorId: 'mod',
			targetUserId: 'other',
			action: 'mute',
			createdAt: new Date(T0)
		});
		const seen: string[] = [];
		let cursor: string | null = null;
		let pages = 0;
		do {
			const page = await listRecentActions(cursor, 3, { accountId: 'target' });
			seen.push(...page.items.map((i) => i.id));
			cursor = page.nextCursor;
			pages++;
		} while (cursor);
		expect(pages).toBe(3);
		expect([...seen].sort()).toEqual(['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
		expect(new Set(seen).size).toBe(7);
	});

	it('lists a deleted account’s actions: its log survives the scrub', async () => {
		await muteUser(mod, 'target', 24, null);
		await db
			.update(users)
			.set({ deletedAt: new Date(), username: null })
			.where(eq(users.id, 'target'));
		const { items } = await listRecentActions(null, undefined, { accountId: 'target' });
		expect(items).toHaveLength(1);
	});

	it('is the whole log without a filter', async () => {
		await muteUser(mod, 'target', 24, null);
		await muteUser(mod, 'other', 24, null);
		expect((await listRecentActions()).items).toHaveLength(2);
	});
});
