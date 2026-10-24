import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { titles } from '$db/schema/titles';
import { titleBechdel, titleUm, umSource } from '$db/schema/sources';
import { db } from '$lib/server/db';
import { getBechdel, getUmEntry } from '$lib/server/data/sources';

const NO_FLAGS = {
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

async function insertTitle() {
	const [row] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', year: 1979, tmdbId: 348 })
		.returning();
	return row;
}

describe('getBechdel', () => {
	it('returns the seeded rating, or null', async () => {
		const title = await insertTitle();
		expect(await getBechdel(title.id)).toBeNull();
		await db
			.insert(titleBechdel)
			.values({ titleId: title.id, bechdelId: 7, rating: 3, numVotes: 9 });
		expect(await getBechdel(title.id)).toMatchObject({ bechdelId: 7, rating: 3, numVotes: 9 });
	});
});

describe('getUmEntry', () => {
	it('returns null without a binding', async () => {
		const title = await insertTitle();
		expect(await getUmEntry(title.id)).toBeNull();
	});

	it('reflects an updated um_source row without reseeding the binding', async () => {
		const title = await insertTitle();
		await db.insert(umSource).values({
			umId: 42,
			cleanName: 'alien',
			cleanTitleKey: 'alien',
			year: 1979,
			comment: null,
			...NO_FLAGS
		});
		await db.insert(titleUm).values({ titleId: title.id, umId: 42 });

		expect(await getUmEntry(title.id)).toEqual({
			umId: 42,
			cleanName: 'alien',
			year: 1979,
			comment: null,
			...NO_FLAGS
		});

		await db
			.update(umSource)
			.set({ noRape: false, attemptedRape: true, comment: 'Updated upstream.' })
			.where(eq(umSource.umId, 42));

		expect(await getUmEntry(title.id)).toMatchObject({
			umId: 42,
			noRape: false,
			attemptedRape: true,
			comment: 'Updated upstream.'
		});
	});
});
