import { count, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { titles } from '$db/schema/titles';
import { titleBechdel, titleUm, umSource } from '$db/schema/sources';
import { toUmEntry } from './sources';
import { umFlagCount } from '$lib/media/utils/metrics';
import { scoreSafety } from '$lib/media/utils/verdict';
import type { CatalogueCounts, RatedFilm } from '$lib/media/types/catalogue';

export type { CatalogueCounts, RatedFilm } from '$lib/media/types/catalogue';

/** Row counts of `title_bechdel` and `um_source`. */
export async function getCatalogueCounts(): Promise<CatalogueCounts> {
	const [[bechdel], [um]] = await Promise.all([
		db.select({ n: count() }).from(titleBechdel),
		db.select({ n: count() }).from(umSource)
	]);
	return { bechdelRatings: bechdel.n, umEntries: um.n };
}

/**
 * The films with a Bechdel Test rating and the most IMDb votes (the seeded `num_votes` column
 * is IMDb's count), with their Unconsenting Media entry when one is bound.
 */
export async function getMostVotedRatedFilms(limit = 6): Promise<RatedFilm[]> {
	const rows = await db
		.select({
			title: titles.title,
			year: titles.year,
			tmdbId: titles.tmdbId,
			rating: titleBechdel.rating,
			um: umSource
		})
		.from(titles)
		.innerJoin(titleBechdel, eq(titleBechdel.titleId, titles.id))
		.leftJoin(titleUm, eq(titleUm.titleId, titles.id))
		.leftJoin(umSource, eq(umSource.umId, titleUm.umId))
		.where(eq(titles.kind, 'movie'))
		.orderBy(desc(titleBechdel.numVotes))
		.limit(limit);

	return rows.map((r) => {
		const entry = r.um ? toUmEntry(r.um) : null;
		const tier = entry
			? scoreSafety(entry, { itemId: null, tags: [], isSeries: false }).tier
			: null;
		return {
			title: r.title,
			year: r.year,
			tmdbId: r.tmdbId,
			bechdelRating: r.rating,
			umConcerns: entry ? umFlagCount(entry) : null,
			umTier: tier === 'unknown' ? null : tier
		};
	});
}
