import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { communityContentReports, comments } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { REPORT_ACCOUNT_MIN_AGE_DAYS } from '#lib/media/utils/communityReports.ts';
import {
	findProfileOwner,
	getProfileComments,
	getProfileReports,
	getPublicProfile
} from '#lib/server/data/profile-queries.ts';

const DAY = 86_400_000;
const old = () => new Date(Date.now() - (REPORT_ACCOUNT_MIN_AGE_DAYS + 30) * DAY);

let alien: string;
let dark: string;

beforeEach(async () => {
	await db.insert(users).values([
		userValues('anna-id', {
			username: 'anna',
			avatarKey: 'anna-av',
			createdAt: old(),
			updatedAt: old()
		}),
		userValues('bea-id', { username: 'bea', createdAt: old(), updatedAt: old() })
	]);
	const rows = await db
		.insert(titles)
		.values([
			{ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 },
			{ kind: 'tv', title: 'Dark', cleanTitle: 'dark', tmdbId: 70523 }
		])
		.returning();
	[alien, dark] = rows.map((t) => t.id);
});

let n = 0;
/** A comment `minutesAgo` old, so the newest-first order is under the test's control. */
async function comment(
	over: Partial<typeof comments.$inferInsert> & { minutesAgo?: number } = {}
): Promise<string> {
	const { minutesAgo = 0, ...rest } = over;
	const id = `c${++n}`;
	const at = new Date(Date.now() - minutesAgo * 60_000);
	await db.insert(comments).values({
		id,
		titleId: alien,
		userId: 'anna-id',
		body: `Body ${id}`,
		status: 'published',
		createdAt: at,
		updatedAt: at,
		...rest
	});
	return id;
}

describe('findProfileOwner', () => {
	it('matches the username case-insensitively', async () => {
		expect(await findProfileOwner('anna')).toMatchObject({ id: 'anna-id', username: 'anna' });
		expect(await findProfileOwner('ANNA')).toMatchObject({ id: 'anna-id' });
	});

	it('still finds every stored shape: 3 characters, a leading digit, double underscores', async () => {
		await db
			.insert(users)
			.values([
				userValues('s3-id', { username: 'ab1' }),
				userValues('s4-id', { username: '9lives' }),
				userValues('s5-id', { username: 'a__b_' })
			]);
		expect(await findProfileOwner('bea')).toMatchObject({ id: 'bea-id' });
		expect(await findProfileOwner('AB1')).toMatchObject({ id: 's3-id' });
		expect(await findProfileOwner('9lives')).toMatchObject({ id: 's4-id' });
		expect(await findProfileOwner('a__b_')).toMatchObject({ id: 's5-id' });
		expect(await getPublicProfile('bea')).toMatchObject({ username: 'bea' });
	});

	it('is null for no match, a banned account, an account without a username and a bad address', async () => {
		await db
			.insert(users)
			.values(userValues('ban-id', { username: 'banned', bannedAt: new Date() }));
		await db.insert(users).values(userValues('none-id'));
		expect(await findProfileOwner('nobody')).toBeNull();
		expect(await findProfileOwner('banned')).toBeNull();
		expect(await findProfileOwner('none-id')).toBeNull();
		expect(await findProfileOwner('not a name!')).toBeNull();
		expect(await findProfileOwner('')).toBeNull();
	});
});

describe('getPublicProfile', () => {
	it('is null for an unknown, banned or username-less account', async () => {
		await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, 'bea-id'));
		expect(await getPublicProfile('nobody')).toBeNull();
		expect(await getPublicProfile('bea')).toBeNull();
	});

	it('shows the account, never an email or a role of an ordinary account', async () => {
		const profile = await getPublicProfile('Anna');
		expect(profile).toMatchObject({
			id: 'anna-id',
			username: 'anna',
			avatarKey: 'anna-av',
			staffRole: null
		});
		expect(profile?.joinedAt).toBe(old().toISOString().slice(0, 10));
		expect(JSON.stringify(profile)).not.toContain('@');
		expect(Object.keys(profile!).sort()).toEqual([
			'avatarKey',
			'commentCount',
			'comments',
			'id',
			'joinedAt',
			'reportCount',
			'reports',
			'scoreTotal',
			'staffRole',
			'titleCount',
			'username'
		]);
	});

	it('carries a staff role only for a moderator or an administrator', async () => {
		await db.insert(users).values(userValues('m-id', { username: 'mod', role: 'moderator' }));
		await db.insert(users).values(userValues('a-id', { username: 'boss', role: 'administrator' }));
		expect((await getPublicProfile('mod'))?.staffRole).toBe('moderator');
		expect((await getPublicProfile('boss'))?.staffRole).toBe('administrator');
	});

	it('lists published comments only, newest first, with no moderation reason', async () => {
		const first = await comment({ minutesAgo: 30 });
		const second = await comment({ minutesAgo: 10, titleId: dark, score: 4 });
		for (const status of ['pending', 'hidden', 'rejected', 'deleted'] as const) {
			await comment({ status, moderationReason: 'Private reason' });
		}
		await comment({ userId: 'bea-id' });
		const profile = await getPublicProfile('anna');
		expect(profile?.comments.comments.map((c) => c.id)).toEqual([second, first]);
		expect(profile?.comments.comments[0]).toMatchObject({
			body: `Body ${second}`,
			score: 4,
			title: { kind: 'tv', tmdbId: 70523, name: 'Dark' },
			inReplyTo: null
		});
		expect(JSON.stringify(profile)).not.toContain('Private reason');
		expect(profile?.comments.comments[0]).not.toHaveProperty('status');
		expect(profile?.comments.comments[0]).not.toHaveProperty('moderationReason');
	});

	it('names the author of the published comment a reply answers, and no one for an unpublished one', async () => {
		const root = await comment({ userId: 'bea-id', minutesAgo: 60 });
		const hiddenRoot = await comment({ userId: 'bea-id', status: 'hidden', minutesAgo: 59 });
		const reply = await comment({ parentId: root, rootId: root, minutesAgo: 20 });
		const orphan = await comment({ parentId: hiddenRoot, rootId: hiddenRoot, minutesAgo: 10 });
		const { comments: list } = (await getPublicProfile('anna'))!.comments;
		expect(list.find((c) => c.id === reply)?.inReplyTo).toEqual({
			displayName: 'bea',
			username: 'bea'
		});
		expect(list.find((c) => c.id === orphan)?.inReplyTo).toBeNull();
	});

	it('sums the score of published comments only, and counts them', async () => {
		await comment({ score: 5 });
		await comment({ score: -2 });
		await comment({ score: 100, status: 'rejected' });
		await comment({ score: 100, status: 'pending' });
		await comment({ score: 100, userId: 'bea-id' });
		expect((await getPublicProfile('anna'))?.scoreTotal).toBe(3);
		expect((await getPublicProfile('anna'))?.commentCount).toBe(2);
		expect((await getPublicProfile('bea'))?.scoreTotal).toBe(100);
		expect((await getPublicProfile('bea'))?.commentCount).toBe(1);
	});

	it('has a zero total and empty lists for an account with nothing public', async () => {
		const profile = await getPublicProfile('bea');
		expect(profile).toMatchObject({
			scoreTotal: 0,
			commentCount: 0,
			reportCount: 0,
			titleCount: 0,
			comments: { comments: [], nextCursor: null },
			reports: { reports: [], nextCursor: null }
		});
	});
});

describe('counted community reports', () => {
	const report = (
		userId: string,
		titleId: string,
		status: 'counted' | 'held' | 'rejected' = 'counted'
	) => db.insert(communityContentReports).values({ userId, titleId, status });

	it('lists the reports that count, by title, newest first', async () => {
		await report('anna-id', alien);
		await db.update(communityContentReports).set({ updatedAt: new Date(Date.now() - 5 * DAY) });
		await report('anna-id', dark);
		await report('bea-id', alien);
		const profile = (await getPublicProfile('anna'))!;
		const { reports } = profile.reports;
		expect(profile.reportCount).toBe(2);
		expect(reports.every((r) => Object.keys(r).sort().join() === 'kind,name,tmdbId')).toBe(true);
		expect(reports.map((r) => [r.kind, r.tmdbId, r.name])).toEqual([
			['tv', 70523, 'Dark'],
			['movie', 348, 'Alien']
		]);
	});

	it('leaves out a held or rejected report', async () => {
		await report('anna-id', alien, 'held');
		await report('anna-id', dark, 'rejected');
		expect((await getPublicProfile('anna'))?.reports.reports).toEqual([]);
		expect((await getPublicProfile('anna'))?.reportCount).toBe(0);
	});

	it('follows the title counts rule: a new, a muted or a banned account has none, staff always count', async () => {
		const fresh = new Date();
		await db.insert(users).values([
			userValues('new-id', { username: 'newbie', createdAt: fresh, updatedAt: fresh }),
			userValues('mute-id', {
				username: 'muted',
				createdAt: old(),
				updatedAt: old(),
				mutedUntil: new Date(Date.now() + DAY)
			}),
			userValues('staff-id', { username: 'staffer', role: 'moderator', createdAt: fresh })
		]);
		for (const id of ['new-id', 'mute-id', 'staff-id']) await report(id, alien);
		expect((await getPublicProfile('newbie'))?.reports.reports).toEqual([]);
		expect((await getPublicProfile('muted'))?.reports.reports).toEqual([]);
		expect((await getPublicProfile('staffer'))?.reports.reports).toHaveLength(1);
		expect((await getPublicProfile('staffer'))?.reportCount).toBe(1);
	});
});

describe('getProfileComments paging', () => {
	it('pages by cursor, newest first, without a repeat or a gap', async () => {
		const ids: string[] = [];
		for (let i = 0; i < 5; i++) ids.push(await comment({ minutesAgo: i }));
		await comment({ status: 'pending', minutesAgo: 0 });
		const one = await getProfileComments('anna-id', null, 2);
		expect(one.comments.map((c) => c.id)).toEqual(ids.slice(0, 2));
		expect(one.nextCursor).not.toBeNull();
		const two = await getProfileComments('anna-id', one.nextCursor, 2);
		expect(two.comments.map((c) => c.id)).toEqual(ids.slice(2, 4));
		const three = await getProfileComments('anna-id', two.nextCursor, 2);
		expect(three.comments.map((c) => c.id)).toEqual(ids.slice(4));
		expect(three.nextCursor).toBeNull();
	});

	it('reads a cursor it did not make as the first page', async () => {
		const id = await comment();
		const page = await getProfileComments('anna-id', 'garbage');
		expect(page.comments.map((c) => c.id)).toEqual([id]);
	});

	it('keeps rows that share a timestamp apart by id', async () => {
		const at = Date.now() - 1000;
		await comment({ createdAt: new Date(at), id: 'tie-a' });
		await comment({ createdAt: new Date(at), id: 'tie-b' });
		const one = await getProfileComments('anna-id', null, 1);
		const two = await getProfileComments('anna-id', one.nextCursor, 1);
		expect([...one.comments, ...two.comments].map((c) => c.id)).toEqual(['tie-b', 'tie-a']);
		expect(two.nextCursor).toBeNull();
	});
});

describe('getProfileComments times', () => {
	it('rounds a comment time down to the minute', async () => {
		await comment({ createdAt: new Date('2026-11-01T10:07:42.123Z') });
		const page = await getProfileComments('anna-id', null);
		expect(page.comments[0].createdAt).toBe('2026-11-01T10:07:00.000Z');
	});
});

describe('the Titles figure', () => {
	const report = (
		userId: string,
		titleId: string,
		status: 'counted' | 'held' | 'rejected' = 'counted'
	) => db.insert(communityContentReports).values({ userId, titleId, status });

	it('counts a title once across a comment and a report on it', async () => {
		await comment({ titleId: alien });
		await comment({ titleId: alien });
		await report('anna-id', alien);
		expect((await getPublicProfile('anna'))?.titleCount).toBe(1);
		await report('anna-id', dark);
		expect((await getPublicProfile('anna'))?.titleCount).toBe(2);
	});

	it('leaves out unpublished comments, uncounted reports and other accounts', async () => {
		await comment({ status: 'pending', titleId: alien });
		await comment({ status: 'rejected', titleId: dark });
		await report('anna-id', alien, 'held');
		await report('anna-id', dark, 'rejected');
		await comment({ userId: 'bea-id', titleId: alien });
		await report('bea-id', dark);
		expect((await getPublicProfile('anna'))?.titleCount).toBe(0);
		expect((await getPublicProfile('bea'))?.titleCount).toBe(2);
	});

	it('counts the title of a report alone, and drops it when the account is muted', async () => {
		await report('anna-id', dark);
		expect((await getPublicProfile('anna'))?.titleCount).toBe(1);
		await db
			.update(users)
			.set({ mutedUntil: new Date(Date.now() + DAY) })
			.where(eq(users.id, 'anna-id'));
		expect((await getPublicProfile('anna'))?.titleCount).toBe(0);
	});
});

describe('getProfileReports paging', () => {
	const titleIds: string[] = [];

	beforeEach(async () => {
		titleIds.length = 0;
		const rows = await db
			.insert(titles)
			.values(
				[0, 1, 2, 3, 4].map((i) => ({
					kind: 'movie' as const,
					title: `Film ${i}`,
					cleanTitle: `film ${i}`,
					tmdbId: 1000 + i
				}))
			)
			.returning();
		for (const [i, row] of rows.entries()) {
			titleIds.push(row.id);
			const at = new Date(Date.now() - i * 60_000);
			await db
				.insert(communityContentReports)
				.values({ userId: 'anna-id', titleId: row.id, createdAt: at, updatedAt: at });
		}
	});

	it('pages by cursor, newest first, without a repeat or a gap, and ends on a null cursor', async () => {
		const names = (page: { reports: { name: string }[] }) => page.reports.map((r) => r.name);
		const one = await getProfileReports('anna-id', null, 2);
		expect(names(one)).toEqual(['Film 0', 'Film 1']);
		expect(one.nextCursor).not.toBeNull();
		const two = await getProfileReports('anna-id', one.nextCursor, 2);
		expect(names(two)).toEqual(['Film 2', 'Film 3']);
		const three = await getProfileReports('anna-id', two.nextCursor, 2);
		expect(names(three)).toEqual(['Film 4']);
		expect(three.nextCursor).toBeNull();
	});

	it('has no cursor when everything fits one page, and reads a cursor it did not make as the first page', async () => {
		const all = await getProfileReports('anna-id', null, 5);
		expect(all.reports).toHaveLength(5);
		expect(all.nextCursor).toBeNull();
		expect((await getProfileReports('anna-id', 'garbage', 2)).reports).toHaveLength(2);
	});

	it('keeps reports that share a timestamp apart by title id', async () => {
		const at = new Date(Date.now() + 5 * 60_000);
		await db.update(communityContentReports).set({ updatedAt: at });
		const seen: string[] = [];
		let cursor: string | null = null;
		do {
			const page = await getProfileReports('anna-id', cursor, 2);
			seen.push(...page.reports.map((r) => r.name));
			cursor = page.nextCursor;
		} while (cursor);
		expect([...seen].sort()).toEqual(['Film 0', 'Film 1', 'Film 2', 'Film 3', 'Film 4']);
		expect(new Set(seen).size).toBe(5);
	});

	it('pages only the reports that count', async () => {
		await db
			.update(communityContentReports)
			.set({ status: 'held' })
			.where(eq(communityContentReports.titleId, titleIds[0]));
		const all = await getProfileReports('anna-id', null, 10);
		expect(all.reports.map((r) => r.name)).toEqual(['Film 1', 'Film 2', 'Film 3', 'Film 4']);
		expect((await getPublicProfile('anna'))?.reportCount).toBe(4);
	});
});
