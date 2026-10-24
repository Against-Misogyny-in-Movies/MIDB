import { describe, it, expect } from 'vitest';
import { umSource } from '$db/schema/sources';
import { db } from '$lib/server/db';
import { getUnconsentingCandidates } from '$lib/server/data/um-candidates';

const FLAGS = {
	noRape: false,
	rapeMenDisImp: true,
	sexHarOnScrn: false,
	sexAdultTeen: false,
	childSexAbuse: false,
	incest: false,
	attemptedRape: true,
	rapeOffScrn: false,
	rapeOnScreen: false
};

async function insertUm(umId: number, cleanTitleKey: string, year: number | null) {
	await db
		.insert(umSource)
		.values({ umId, cleanName: cleanTitleKey, cleanTitleKey, year, comment: null, ...FLAGS });
}

const ref = (title: string, releaseDate: string) => ({
	title,
	imdbId: null,
	tmdbId: '1',
	releaseDate
});

describe('getUnconsentingCandidates', () => {
	it('returns the exact-year entry alone', async () => {
		await insertUm(1, 'wuthering heights', 1939);
		await insertUm(2, 'wuthering heights', 2011);
		await insertUm(3, 'wuthering heights', null);
		const result = await getUnconsentingCandidates(ref('Wuthering Heights', '2011-10-05'));
		expect(result.map((c) => c.umId)).toEqual([2]);
		expect(result[0]).toMatchObject({ year: 2011, attemptedRape: true, noRape: false });
	});

	it('offers unknown-year entries when no year matches', async () => {
		await insertUm(1, 'mean girls', 2004);
		await insertUm(2, 'mean girls', null);
		const result = await getUnconsentingCandidates(ref('Mean Girls', '2024-01-12'));
		expect(result.map((c) => c.umId)).toEqual([2]);
	});

	it('returns every candidate when the title year is unknown', async () => {
		await insertUm(1, 'dracula', 1931);
		await insertUm(2, 'dracula', 1992);
		const result = await getUnconsentingCandidates(ref('Dracula', ''));
		expect(result.map((c) => c.umId).sort()).toEqual([1, 2]);
	});

	it('returns nothing when the year is known and no entry shares it', async () => {
		await insertUm(1, 'dracula', 1931);
		expect(await getUnconsentingCandidates(ref('Dracula', '2025-01-01'))).toEqual([]);
	});

	it('returns nothing when no entry has the title key', async () => {
		await insertUm(1, 'dracula', 1931);
		expect(await getUnconsentingCandidates(ref('Alien', '1979-05-25'))).toEqual([]);
	});

	it('matches the singular/plural alternate key', async () => {
		await insertUm(1, 'alien', 1979);
		const result = await getUnconsentingCandidates(ref('Aliens', ''));
		expect(result.map((c) => c.umId)).toEqual([1]);
	});
});
