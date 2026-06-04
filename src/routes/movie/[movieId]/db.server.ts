import { eq, inArray } from 'drizzle-orm';
import db from '$db/connections';
import { movies, movieBechdel, movieUnconsenting, umSource } from '$db/schema/movie';
import { normalizeTitle, stripTrailingYear } from '$db/scripts/lib/normalizeTitle';
import type { UmCandidate } from '$lib/movie/metrics.js';

export type BechdelData = typeof movieBechdel.$inferSelect;
export type UnconsentingData = typeof movieUnconsenting.$inferSelect;

/** Minimal structural type that both Movie and Series satisfy. */
export interface MediaRef {
	title: string;
	imdbId: string | null;
	tmdbId: string;
	releaseDate: string;
}

export async function getOrCreateDbMovie(media: MediaRef): Promise<typeof movies.$inferSelect> {
	const tmdbId = parseInt(media.tmdbId, 10);

	// Try by tmdbId first (fast path after first visit)
	if (!isNaN(tmdbId)) {
		const existing = await db.query.movies.findFirst({ where: eq(movies.tmdbId, tmdbId) });
		if (existing) {
			// Backfill imdbId if we now have it and it was missing
			if (!existing.imdbId && media.imdbId) {
				await db.update(movies).set({ imdbId: media.imdbId }).where(eq(movies.id, existing.id));
				return { ...existing, imdbId: media.imdbId };
			}
			return existing;
		}
	}

	// Try by imdbId
	if (media.imdbId) {
		const existing = await db.query.movies.findFirst({ where: eq(movies.imdbId, media.imdbId) });
		if (existing) {
			// Backfill tmdbId
			if (!existing.tmdbId && !isNaN(tmdbId)) {
				await db
					.update(movies)
					.set({ tmdbId, updatedAt: new Date() })
					.where(eq(movies.id, existing.id));
				return { ...existing, tmdbId };
			}
			return existing;
		}
	}

	// Not found — create a new row (movie not in Bechdel CSV)
	const [created] = await db
		.insert(movies)
		.values({
			imdbId: media.imdbId ?? `tmdb:${media.tmdbId}`,
			tmdbId: isNaN(tmdbId) ? null : tmdbId,
			title: media.title,
			year: media.releaseDate ? parseInt(media.releaseDate.slice(0, 4), 10) : 0,
			cleanTitle: normalizeTitle(media.title)
		})
		.returning();
	return created;
}

/**
 * Wrapper for TV series: routes through tmdb-tv: namespaced synthetic imdb id
 * and null tmdbId to avoid unique-constraint collisions with movie tmdb ids.
 * Movies pass through unchanged.
 */
export async function getOrCreateDbMedia(
	media: MediaRef,
	kind: 'movie' | 'tv' = 'movie'
): Promise<typeof movies.$inferSelect> {
	if (kind === 'tv') {
		return getOrCreateDbMovie({
			...media,
			imdbId: media.imdbId ?? `tmdb-tv:${media.tmdbId}`,
			tmdbId: '0' // forces NaN parse → null in DB, avoiding movie tmdb_id collision
		});
	}
	return getOrCreateDbMovie(media);
}

export async function getBechdel(movieId: string): Promise<BechdelData | null> {
	return (
		(await db.query.movieBechdel.findFirst({ where: eq(movieBechdel.movieId, movieId) })) ?? null
	);
}

export async function getUnconsenting(movieId: string): Promise<UnconsentingData | null> {
	return (
		(await db.query.movieUnconsenting.findFirst({
			where: eq(movieUnconsenting.movieId, movieId)
		})) ?? null
	);
}

export type { UmCandidate } from '$lib/movie/metrics.js';

// Concern flags exclude `noRape` — that flag being true is a reassurance
// ("no rape or sexual assault"), the inverse of the others, so it never counts.
const UM_CONCERN_COLS = [
	'rapeMenDisImp',
	'sexHarOnScrn',
	'sexAdultTeen',
	'childSexAbuse',
	'incest',
	'attemptedRape',
	'rapeOffScrn',
	'rapeOnScreen'
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
		rapeOnScreen: r.rapeOnScreen
	};
}

/**
 * Resolve UM catalogue entries for a media item whose title has no seeded binding.
 *
 * Year is the disambiguator:
 *  - exact-year match → return it alone (rendered directly, no picker).
 *  - year known but no candidate shares it → this title isn't in UM; return [].
 *  - year unknown → genuinely ambiguous; return all candidates for the user to pick from.
 *
 * Nothing is persisted; a user's pick lives only for the current page view.
 */
export async function getUnconsentingCandidates(media: MediaRef): Promise<UmCandidate[]> {
	const titleKey = stripTrailingYear(normalizeTitle(media.title)).key;

	// Build a small set of keys to try: exact, +s, -s (handles "Troubles" vs "Trouble" etc.)
	const altKeys = new Set([titleKey]);
	if (titleKey.endsWith('s')) altKeys.add(titleKey.slice(0, -1));
	else altKeys.add(titleKey + 's');
	const keys = [...altKeys];

	const rows = await db.query.umSource.findMany({
		where: keys.length === 1 ? eq(umSource.cleanTitleKey, keys[0]) : inArray(umSource.cleanTitleKey, keys)
	});
	if (rows.length === 0) return [];

	const mediaYear = media.releaseDate ? parseInt(media.releaseDate.slice(0, 4), 10) : NaN;

	if (!Number.isNaN(mediaYear)) {
		const exact = rows.find((r) => r.year === mediaYear);
		if (exact) return [toCandidate(exact)];
		// A null year in UM means UM doesn't know the year — still a valid candidate.
		const nullYear = rows.filter((r) => r.year === null);
		if (nullYear.length > 0) return nullYear.slice(0, 5).map(toCandidate);
		// Year known and UM has no matching or year-unknown entry → not in UM.
		return [];
	}

	// Year unknown → present all candidates for manual disambiguation.
	return rows.slice(0, 5).map(toCandidate);
}
