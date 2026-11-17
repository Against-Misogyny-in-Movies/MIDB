import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { communityContentReports, comments } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { getOwnProfile } from '#lib/server/data/own-profile.ts';

const DAY = 86_400_000;
let alien: string;
let dark: string;

beforeEach(async () => {
	const old = new Date(Date.now() - 400 * DAY);
	await db
		.insert(users)
		.values([
			userValues('anna-id', { username: 'anna', createdAt: old, updatedAt: old }),
			userValues('bea-id', { username: 'bea', createdAt: old, updatedAt: old })
		]);
	[{ id: alien }, { id: dark }] = await db
		.insert(titles)
		.values([
			{ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 },
			{ kind: 'tv', title: 'Dark', cleanTitle: 'dark', tmdbId: 70523 }
		])
		.returning();
});

describe('getOwnProfile', () => {
	it('lists the owner’s comments that are not public, in every status but published, and none of another account', async () => {
		await db.insert(comments).values([
			{ id: 'p', titleId: alien, userId: 'anna-id', body: 'Published', status: 'published' },
			{
				id: 'r',
				titleId: alien,
				userId: 'anna-id',
				body: 'Rejected',
				status: 'rejected',
				moderationReason: 'A slur'
			},
			{ id: 'w', titleId: alien, userId: 'anna-id', body: 'Waiting', status: 'pending' },
			{ id: 'h', titleId: alien, userId: 'anna-id', body: 'Hidden', status: 'hidden' },
			{ id: 'd', titleId: alien, userId: 'anna-id', body: 'Deleted', status: 'deleted' },
			{ id: 'b', titleId: alien, userId: 'bea-id', body: 'Not hers', status: 'pending' }
		]);
		const own = await getOwnProfile({ id: 'anna-id', mutedUntil: null });
		expect(own.notPublic.comments.map((c) => c.id).sort()).toEqual(['d', 'h', 'r', 'w']);
		const rejected = own.notPublic.comments.find((c) => c.id === 'r')!;
		expect(rejected).toMatchObject({
			status: 'rejected',
			moderationReason: 'A slur',
			kind: 'movie'
		});
		expect(typeof rejected.createdAt).toBe('string');
	});

	it('gives the reply counts of the published comments that have replies, for their delete', async () => {
		await db.insert(comments).values([
			{
				id: 'with',
				titleId: alien,
				userId: 'anna-id',
				body: 'Has replies',
				status: 'published',
				replyCount: 2
			},
			{ id: 'none', titleId: alien, userId: 'anna-id', body: 'Alone', status: 'published' },
			{
				id: 'gone',
				titleId: alien,
				userId: 'anna-id',
				body: 'Hidden',
				status: 'hidden',
				replyCount: 3
			},
			{
				id: 'hers',
				titleId: alien,
				userId: 'bea-id',
				body: 'Another account',
				status: 'published',
				replyCount: 4
			}
		]);
		expect((await getOwnProfile({ id: 'anna-id', mutedUntil: null })).replyCounts).toEqual({
			with: 2
		});
	});

	it('lists only the reports that are not public, with the inputs of their standing', async () => {
		await db
			.insert(communityContentReports)
			.values({ userId: 'anna-id', titleId: alien, status: 'held' });
		await db
			.insert(communityContentReports)
			.values({ userId: 'anna-id', titleId: dark, status: 'counted' });
		const own = await getOwnProfile({ id: 'anna-id', mutedUntil: null });
		expect(own.notPublic.reports).toEqual([
			{
				titleId: alien,
				status: 'held',
				kind: 'movie',
				tmdbId: 348,
				title: 'Alien',
				updatedAt: expect.any(String) as string,
				countsFrom: expect.any(String) as string,
				restricted: null
			}
		]);
	});

	it('moves a counted report out of the public list when its account is too new or muted', async () => {
		const fresh = new Date();
		await db.insert(users).values([
			userValues('new-id', { username: 'newbie', createdAt: fresh, updatedAt: fresh }),
			userValues('mute-id', {
				username: 'muted',
				createdAt: new Date(Date.now() - 400 * DAY),
				mutedUntil: new Date(Date.now() + DAY)
			})
		]);
		for (const userId of ['new-id', 'mute-id']) {
			await db.insert(communityContentReports).values({ userId, titleId: alien });
		}
		const young = await getOwnProfile({ id: 'new-id', mutedUntil: null });
		expect(young.notPublic.reports).toHaveLength(1);
		expect(new Date(young.notPublic.reports[0].countsFrom).getTime()).toBeGreaterThan(Date.now());
		const muted = await getOwnProfile({ id: 'mute-id', mutedUntil: null });
		expect(muted.notPublic.reports[0]).toMatchObject({ status: 'counted', restricted: 'muted' });
	});

	it('is empty for an account whose comments and reports are all public', async () => {
		await db
			.insert(comments)
			.values({ id: 'p', titleId: alien, userId: 'anna-id', body: 'Public', status: 'published' });
		await db.insert(communityContentReports).values({ userId: 'anna-id', titleId: alien });
		expect(await getOwnProfile({ id: 'anna-id', mutedUntil: null })).toEqual({
			notPublic: { comments: [], reports: [] },
			replyCounts: {},
			mutedUntil: null
		});
	});

	it('names a mute only while it lasts', async () => {
		const until = new Date(Date.now() + DAY);
		expect((await getOwnProfile({ id: 'anna-id', mutedUntil: until })).mutedUntil).toBe(
			until.toISOString()
		);
		expect(
			(await getOwnProfile({ id: 'anna-id', mutedUntil: new Date(Date.now() - DAY) })).mutedUntil
		).toBeNull();
	});
});
