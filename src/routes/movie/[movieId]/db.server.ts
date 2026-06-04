import { eq } from 'drizzle-orm';
import db from '$db/connections';
import { movies, movieBechdel, movieUnconsenting, umSource } from '$db/schema/movie';
import { normalizeTitle, stripTrailingYear } from '$db/scripts/lib/normalizeTitle';
import type { Movie } from './types';
import type { UmCandidate } from '$lib/movie/metrics.js';

export type BechdelData = typeof movieBechdel.$inferSelect;
export type UnconsentingData = typeof movieUnconsenting.$inferSelect;

export async function getOrCreateDbMovie(movie: Movie): Promise<typeof movies.$inferSelect> {
	const tmdbId = parseInt(movie.tmdbId, 10);

	// Try by tmdbId first (fast path after first visit)
	if (!isNaN(tmdbId)) {
		const existing = await db.query.movies.findFirst({ where: eq(movies.tmdbId, tmdbId) });
		if (existing) {
			// Backfill imdbId if we now have it and it was missing
			if (!existing.imdbId && movie.imdbId) {
				await db.update(movies).set({ imdbId: movie.imdbId }).where(eq(movies.id, existing.id));
				return { ...existing, imdbId: movie.imdbId };
			}
			return existing;
		}
	}

	// Try by imdbId
	if (movie.imdbId) {
		const existing = await db.query.movies.findFirst({ where: eq(movies.imdbId, movie.imdbId) });
		if (existing) {
			// Backfill tmdbId
			if (!existing.tmdbId && !isNaN(tmdbId)) {
				await db.update(movies).set({ tmdbId, updatedAt: new Date() }).where(eq(movies.id, existing.id));
				return { ...existing, tmdbId };
			}
			return existing;
		}
	}

	// Not found — create a new row (movie not in Bechdel CSV)
	const [created] = await db
		.insert(movies)
		.values({
			imdbId: movie.imdbId ?? `tmdb:${movie.tmdbId}`,
			tmdbId: isNaN(tmdbId) ? null : tmdbId,
			title: movie.title,
			year: movie.releaseDate ? parseInt(movie.releaseDate.slice(0, 4), 10) : 0,
			cleanTitle: normalizeTitle(movie.title),
		})
		.returning();
	return created;
}

export async function getBechdel(movieId: string): Promise<BechdelData | null> {
	return (await db.query.movieBechdel.findFirst({ where: eq(movieBechdel.movieId, movieId) })) ?? null;
}

export async function getUnconsenting(movieId: string): Promise<UnconsentingData | null> {
	return (await db.query.movieUnconsenting.findFirst({ where: eq(movieUnconsenting.movieId, movieId) })) ?? null;
}

export type { UmCandidate } from '$lib/movie/metrics.js';

// Concern flags exclude `noRape` — that flag being true is a reassurance
// ("no rape or sexual assault"), the inverse of the others, so it never counts.
const UM_CONCERN_COLS = [
	'rapeMenDisImp', 'sexHarOnScrn', 'sexAdultTeen', 'childSexAbuse',
	'incest', 'attemptedRape', 'rapeOffScrn', 'rapeOnScreen',
] as const;

function toCandidate(r: typeof umSource.$inferSelect): UmCandidate {
	return {
		umId: r.umId,
		cleanName: r.cleanName,
		year: r.year,
		flagCount: UM_CONCERN_COLS.filter((k) => r[k] === true).length,
		comment: r.comment,
		noRape: r.noRape,
		rapeMenDisImp: r.rapeMenDisImp,
		sexHarOnScrn: r.sexHarOnScrn,
		sexAdultTeen: r.sexAdultTeen,
		childSexAbuse: r.childSexAbuse,
		incest: r.incest,
		attemptedRape: r.attemptedRape,
		rapeOffScrn: r.rapeOffScrn,
		rapeOnScreen: r.rapeOnScreen,
	};
}

/**
 * Resolve UM catalogue entries for a movie whose title has no seeded binding.
 *
 * Year is the disambiguator:
 *  - exact-year match → return it alone (rendered directly, no picker).
 *  - movie year known but no candidate shares it → this film isn't in UM;
 *    return [] so the section honestly shows "No data" rather than inviting the
 *    user to mis-attribute a different year's data.
 *  - movie year unknown → genuinely ambiguous; return all candidates for the
 *    user to pick from.
 *
 * Nothing is persisted; a user's pick lives only for the current page view.
 */
export async function getUnconsentingCandidates(movie: Movie): Promise<UmCandidate[]> {
	const titleKey = stripTrailingYear(normalizeTitle(movie.title)).key;
	const rows = await db.query.umSource.findMany({
		where: eq(umSource.cleanTitleKey, titleKey),
	});
	if (rows.length === 0) return [];

	const movieYear = movie.releaseDate ? parseInt(movie.releaseDate.slice(0, 4), 10) : NaN;

	if (!Number.isNaN(movieYear)) {
		const exact = rows.find((r) => r.year === movieYear);
		if (exact) return [toCandidate(exact)];
		// Year known but no UM entry for it → not in UM; don't offer mismatches.
		return [];
	}

	// Year unknown → present all candidates for manual disambiguation.
	return rows.slice(0, 5).map(toCandidate);
}
