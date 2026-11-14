import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { communityContentReports, comments } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { getOwnProfile } from '#lib/server/data/own-profile.ts';

const DAY = 86_400_000;
let alien: string;

beforeEach(async () => {
	const old = new Date(Date.now() - 400 * DAY);
	await db
		.insert(users)
		.values([
			userValues('anna-id', { username: 'anna', createdAt: old, updatedAt: old }),
			userValues('bea-id', { username: 'bea', createdAt: old, updatedAt: old })
		]);
	[{ id: alien }] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
});

describe('getOwnProfile', () => {
	it('lists the owner’s comments in every status, and none of another account', async () => {
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
			{ id: 'b', titleId: alien, userId: 'bea-id', body: 'Not hers', status: 'published' }
		]);
		const own = await getOwnProfile({ id: 'anna-id', mutedUntil: null });
		expect(own.comments.map((c) => c.id).sort()).toEqual(['p', 'r']);
		const rejected = own.comments.find((c) => c.id === 'r')!;
		expect(rejected).toMatchObject({
			status: 'rejected',
			moderationReason: 'A slur',
			kind: 'movie'
		});
		expect(typeof rejected.createdAt).toBe('string');
	});

	it('lists the owner’s reports in every status, with the inputs of their standing', async () => {
		await db
			.insert(communityContentReports)
			.values({ userId: 'anna-id', titleId: alien, status: 'held' });
		const own = await getOwnProfile({ id: 'anna-id', mutedUntil: null });
		expect(own.reports).toEqual([
			{
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
