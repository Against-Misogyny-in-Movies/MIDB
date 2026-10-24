import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { seedMovies } from '$db/scripts/seedMovies';
import { seedUnconsenting } from '$db/scripts/seedUnconsenting';

const BECHDEL_CSV = 'db/test/fixtures/bechdel.csv';
const UM_CSV = 'db/test/fixtures/unconsenting.csv';

async function counts() {
	const [row] = await db.execute<{
		titles: number;
		bechdel: number;
		um: number;
		bindings: number;
		badYears: number;
	}>(sql`SELECT
		(SELECT count(*)::int FROM titles) AS titles,
		(SELECT count(*)::int FROM title_bechdel) AS bechdel,
		(SELECT count(*)::int FROM um_source) AS um,
		(SELECT count(*)::int FROM title_um) AS bindings,
		(SELECT count(*)::int FROM titles WHERE year <= 0 OR kind <> 'movie') +
		(SELECT count(*)::int FROM um_source WHERE year <= 0) AS "badYears"`);
	return row;
}

describe('seeders (50-row fixtures)', () => {
	it('seedMovies writes movie titles and their Bechdel ratings, idempotently', async () => {
		expect(await seedMovies(db, BECHDEL_CSV)).toEqual({ total: 50, skipped: 0 });
		expect(await counts()).toMatchObject({ titles: 50, bechdel: 50, badYears: 0 });

		await seedMovies(db, BECHDEL_CSV);
		expect(await counts()).toMatchObject({ titles: 50, bechdel: 50 });
	});

	it('seedUnconsenting writes the catalogue and binds matches by reference', async () => {
		const report = join(mkdtempSync(join(tmpdir(), 'midb-seed-')), 'unmatched.txt');
		await seedMovies(db, BECHDEL_CSV);

		const stats = await seedUnconsenting(db, UM_CSV, report);
		expect(stats).toMatchObject({ total: 50, matched: 30, skipped: 0 });
		expect(await counts()).toMatchObject({ um: 50, bindings: 30, badYears: 0 });
		expect(readFileSync(report, 'utf8').split('\n')[0]).toMatch(/^id\tname/);

		// Bindings carry only (title_id, um_id); every flag is read from um_source.
		const [binding] = await db.execute<Record<string, unknown>>(
			sql`SELECT * FROM title_um LIMIT 1`
		);
		expect(Object.keys(binding).sort()).toEqual(['created_at', 'title_id', 'um_id']);

		await seedUnconsenting(db, UM_CSV, report);
		expect(await counts()).toMatchObject({ um: 50, bindings: 30 });
	});
});
