import { describe, it, expect, beforeEach } from 'vitest';
import { titles } from '$db/schema/titles';
import { users } from '$db/schema/auth';
import {
	comments,
	communityBechdelRatings,
	communityDddVotes,
	communityUmReports
} from '$db/schema/community';
import { db } from '$lib/server/db';

const FLAGS = {
	noRape: true,
	rapeMenDisImp: false,
	sexHarOnScrn: false,
	sexAdultTeen: false,
	childSexAbuse: false,
	incest: false,
	attemptedRape: false,
	rapeOffScrn: false,
	rapeOnScreen: false
};

let titleId: string;
const userId = 'sub-1';

beforeEach(async () => {
	await db.insert(users).values({ id: userId });
	const [title] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
	titleId = title.id;
});

describe('community_bechdel_ratings', () => {
	it('rejects a second rating for the same (user, title)', async () => {
		await db.insert(communityBechdelRatings).values({ userId, titleId, rating: 2 });
		await expect(
			db.insert(communityBechdelRatings).values({ userId, titleId, rating: 3 })
		).rejects.toThrow();
	});

	it('rejects a rating outside 0..3', async () => {
		await expect(
			db.insert(communityBechdelRatings).values({ userId, titleId, rating: 4 })
		).rejects.toThrow();
		await expect(
			db.insert(communityBechdelRatings).values({ userId, titleId, rating: -1 })
		).rejects.toThrow();
	});
});

describe('community_um_reports', () => {
	it('rejects a second report for the same (user, title)', async () => {
		await db.insert(communityUmReports).values({ userId, titleId, ...FLAGS });
		await expect(
			db.insert(communityUmReports).values({ userId, titleId, ...FLAGS })
		).rejects.toThrow();
	});
});

describe('community_ddd_votes', () => {
	it('treats null season/episode as equal for uniqueness', async () => {
		const vote = { userId, titleId, topicId: 153, season: null, episode: null, yes: true };
		await db.insert(communityDddVotes).values(vote);
		await expect(db.insert(communityDddVotes).values({ ...vote, yes: false })).rejects.toThrow();
	});

	it('allows one vote per episode on the same topic', async () => {
		const vote = { userId, titleId, topicId: 153, yes: true };
		await db.insert(communityDddVotes).values([
			{ ...vote, season: null, episode: null },
			{ ...vote, season: 1, episode: 1 },
			{ ...vote, season: 1, episode: 2 }
		]);
		await expect(
			db.insert(communityDddVotes).values({ ...vote, season: 1, episode: 2 })
		).rejects.toThrow();
	});
});

describe('comments', () => {
	it('defaults status to visible and rejects an empty or oversized body', async () => {
		const [row] = await db
			.insert(comments)
			.values({ userId, titleId, body: 'Useful.' })
			.returning();
		expect(row.status).toBe('visible');
		await expect(db.insert(comments).values({ userId, titleId, body: '' })).rejects.toThrow();
		await expect(
			db.insert(comments).values({ userId, titleId, body: 'x'.repeat(5001) })
		).rejects.toThrow();
	});
});

describe('timestamps()', () => {
	it('bumps updated_at on update', async () => {
		const old = new Date('2020-01-01T00:00:00Z');
		await db
			.insert(communityBechdelRatings)
			.values({ userId, titleId, rating: 1, createdAt: old, updatedAt: old });
		const [row] = await db.update(communityBechdelRatings).set({ rating: 2 }).returning();
		expect(row.createdAt).toEqual(old);
		expect(row.updatedAt.getTime()).toBeGreaterThan(old.getTime());
	});
});
