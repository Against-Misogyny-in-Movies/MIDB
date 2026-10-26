import { describe, it, expect } from 'vitest';
import { titles } from '$db/schema/titles';
import { titleBechdel, titleUm, umSource } from '$db/schema/sources';
import { db } from '$lib/server/db';
import { getCatalogueCounts, getMostVotedRatedFilms } from '$lib/server/data/catalogue';

const FLAGS = {
	noRape: false,
	rapeMenDisImp: false,
	sexHarOnScrn: false,
	sexAdultTeen: false,
	childSexAbuse: false,
	incest: false,
	attemptedRape: false,
	rapeOffScrn: false,
	rapeOnScreen: false
};

async function film(title: string, numVotes: number, rating: number, tmdbId: number | null) {
	const [row] = await db
		.insert(titles)
		.values({ kind: 'movie', title, cleanTitle: title.toLowerCase(), year: 2000, tmdbId })
		.returning();
	await db.insert(titleBechdel).values({ titleId: row.id, bechdelId: numVotes, rating, numVotes });
	return row;
}

describe('getCatalogueCounts', () => {
	it('counts Bechdel ratings and UM entries', async () => {
		await film('A', 10, 3, 1);
		await db.insert(umSource).values({ umId: 1, cleanName: 'x', cleanTitleKey: 'x', ...FLAGS });
		await db.insert(umSource).values({ umId: 2, cleanName: 'y', cleanTitleKey: 'y', ...FLAGS });
		expect(await getCatalogueCounts()).toEqual({ bechdelRatings: 1, umEntries: 2 });
	});
});

describe('getMostVotedRatedFilms', () => {
	it('orders by votes and reads the bound UM entry', async () => {
		await film('Quiet', 5, 1, null);
		const loud = await film('Loud', 50, 3, 603);
		await db.insert(umSource).values({
			umId: 9,
			cleanName: 'loud',
			cleanTitleKey: 'loud',
			...FLAGS,
			rapeMenDisImp: true,
			rapeOnScreen: true
		});
		await db.insert(titleUm).values({ titleId: loud.id, umId: 9 });

		const films = await getMostVotedRatedFilms(5);
		expect(films).toEqual([
			{
				title: 'Loud',
				year: 2000,
				tmdbId: 603,
				bechdelRating: 3,
				umConcerns: 2,
				umTier: 'harmful'
			},
			{
				title: 'Quiet',
				year: 2000,
				tmdbId: null,
				bechdelRating: 1,
				umConcerns: null,
				umTier: null
			}
		]);
	});

	it('reads a caution-only entry as caution and no flags as safe', async () => {
		const a = await film('Caution', 20, 2, 1);
		const b = await film('Clear', 10, 2, 2);
		await db
			.insert(umSource)
			.values({ umId: 1, cleanName: 'c', cleanTitleKey: 'c', ...FLAGS, sexHarOnScrn: true });
		await db
			.insert(umSource)
			.values({ umId: 2, cleanName: 'd', cleanTitleKey: 'd', ...FLAGS, noRape: true });
		await db.insert(titleUm).values([
			{ titleId: a.id, umId: 1 },
			{ titleId: b.id, umId: 2 }
		]);

		const films = await getMostVotedRatedFilms();
		expect(films.map((f) => [f.title, f.umConcerns, f.umTier])).toEqual([
			['Caution', 1, 'caution'],
			['Clear', 0, 'safe']
		]);
	});

	it('requireUmEntry keeps only films with an Unconsenting Media entry', async () => {
		await film('Unbound', 99, 3, 1);
		const bound = await film('Bound', 10, 2, 2);
		await db.insert(umSource).values({ umId: 5, cleanName: 'b', cleanTitleKey: 'b', ...FLAGS });
		await db.insert(titleUm).values({ titleId: bound.id, umId: 5 });

		expect((await getMostVotedRatedFilms(5)).map((f) => f.title)).toEqual(['Unbound', 'Bound']);
		expect((await getMostVotedRatedFilms(5, { requireUmEntry: true })).map((f) => f.title)).toEqual(
			['Bound']
		);
	});
});
