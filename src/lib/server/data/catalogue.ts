import { and, count, desc, eq, isNotNull } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { getCached } from '#lib/server/cache/index.ts';
import { titles } from '#db/schema/titles.ts';
import { titleBechdel, titleUm, umSource } from '#db/schema/sources.ts';
import { toUmEntry } from './sources';
import { umFlagCount } from '#lib/media/utils/metrics.ts';
import { scoreSafety } from '#lib/media/utils/verdict.ts';
import type { CatalogueCounts, LinkedRatedFilm, RatedFilm } from '#lib/media/types/catalogue.ts';

export type { CatalogueCounts, LinkedRatedFilm, RatedFilm } from '#lib/media/types/catalogue.ts';

/** Seeded data changes on the daily sync, so the landing's queries are kept for an hour. */
const LANDING_TTL_MS = 60 * 60 * 1000;

/** Row counts of `title_bechdel` and `um_source`, cached for an hour. */
export function getCatalogueCounts(): Promise<CatalogueCounts> {
	return getCached('catalogue:counts', LANDING_TTL_MS, async () => {
		const [[bechdel], [um]] = await Promise.all([
			db.select({ n: count() }).from(titleBechdel),
			db.select({ n: count() }).from(umSource)
		]);
		return { bechdelRatings: bechdel.n, umEntries: um.n };
	});
}

/**
 * The films with a Bechdel Test rating and the most IMDb votes (the seeded `num_votes` column
 * is IMDb's count), with their Unconsenting Media entry when one is bound. With
 * `requireUmEntry`, only films that have one; with `requireTmdbId`, only films that have a page.
 */
export async function getMostVotedRatedFilms(
	limit = 6,
	{
		requireUmEntry = false,
		requireTmdbId = false
	}: { requireUmEntry?: boolean; requireTmdbId?: boolean } = {}
): Promise<RatedFilm[]> {
	const base = db
		.select({
			title: titles.title,
			year: titles.year,
			tmdbId: titles.tmdbId,
			rating: titleBechdel.rating,
			um: umSource
		})
		.from(titles)
		.innerJoin(titleBechdel, eq(titleBechdel.titleId, titles.id));
	const joined = requireUmEntry
		? base
				.innerJoin(titleUm, eq(titleUm.titleId, titles.id))
				.innerJoin(umSource, eq(umSource.umId, titleUm.umId))
		: base
				.leftJoin(titleUm, eq(titleUm.titleId, titles.id))
				.leftJoin(umSource, eq(umSource.umId, titleUm.umId));
	const rows = await joined
		.where(and(eq(titles.kind, 'movie'), requireTmdbId ? isNotNull(titles.tmdbId) : undefined))
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

/**
 * `count` films picked at random from the `pool` most IMDb-voted films that have a Bechdel
 * rating, an Unconsenting Media entry and a TMDB id (so each links to its page). The landing
 * hero calls it on every request. The pool is cached for an hour; the shuffle runs per call.
 */
export async function getRandomRatedFilms(count = 6, pool = 100): Promise<LinkedRatedFilm[]> {
	const ranked = await getCached(`catalogue:hero-pool:${pool}`, LANDING_TTL_MS, () =>
		getMostVotedRatedFilms(pool, { requireUmEntry: true, requireTmdbId: true })
	);
	// `filter` copies, so the shuffle below never reorders the cached array.
	const films = ranked.filter((film): film is LinkedRatedFilm => film.tmdbId !== null);
	// Partial Fisher–Yates: the first `count` slots end up a uniform random sample.
	for (let i = 0; i < Math.min(count, films.length); i++) {
		const j = i + Math.floor(Math.random() * (films.length - i));
		[films[i], films[j]] = [films[j], films[i]];
	}
	return films.slice(0, count);
}
