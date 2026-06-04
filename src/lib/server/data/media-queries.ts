import { eq } from 'drizzle-orm';
import db from '$db/connections';
import { movies, movieBechdel, movieUnconsenting } from '$db/schema/movie';
import { normalizeTitle } from '$db/scripts/lib/normalizeTitle';

export type BechdelData = typeof movieBechdel.$inferSelect;
export type UnconsentingData = typeof movieUnconsenting.$inferSelect;

/** Minimal structural type that both Movie and Series satisfy. */
export interface MediaRef {
	title: string;
	imdbId: string | null;
	tmdbId: string;
	releaseDate: string;
}

/**
 * Read-only identity resolution. Returns the matching movies row, or null if this
 * media has never been written to the DB. Use this on GET routes (detail pages) so
 * a page visit never mutates the database. When the row is absent, Bechdel/UM
 * queries are skipped entirely rather than inserting a row nothing reads back.
 *
 * @param media - Minimal media descriptor with at least one of `tmdbId` or `imdbId`.
 * @returns The matching `movies` row, or `null` if no row exists for this media.
 */
export async function getDbMovie(
	media: MediaRef
): Promise<typeof movies.$inferSelect | null> {
	const tmdbId = parseInt(media.tmdbId, 10);

	if (!isNaN(tmdbId)) {
		const existing = await db.query.movies.findFirst({ where: eq(movies.tmdbId, tmdbId) });
		if (existing) return existing;
	}

	if (media.imdbId) {
		const existing = await db.query.movies.findFirst({ where: eq(movies.imdbId, media.imdbId) });
		if (existing) return existing;
	}

	return null;
}

/**
 * Read-only wrapper for TV series. Mirrors getDbMedia's id-namespace logic
 * (synthetic tmdb-tv: imdbId, null tmdbId) so the lookup matches how TV rows
 * were originally created.
 *
 * @param media - Minimal media descriptor with at least one id field.
 * @param kind - `'tv'` applies the synthetic id namespace; `'movie'` delegates straight to `getDbMovie`.
 * @returns The matching `movies` row, or `null` if no row exists.
 */
export async function getDbMedia(
	media: MediaRef,
	kind: 'movie' | 'tv' = 'movie'
): Promise<typeof movies.$inferSelect | null> {
	if (kind === 'tv') {
		return getDbMovie({
			...media,
			imdbId: media.imdbId ?? `tmdb-tv:${media.tmdbId}`,
			tmdbId: '0'
		});
	}
	return getDbMovie(media);
}

/**
 * Finds an existing `movies` row by TMDB id or IMDb id, or inserts a new one.
 * Also backfills whichever id was missing when found (e.g. a Bechdel-seeded row that had no tmdbId).
 *
 * @param media - Media descriptor with `title`, `releaseDate`, and at least one id field.
 * @returns The found or newly created `movies` row.
 */
export async function getOrCreateDbMovie(media: MediaRef): Promise<typeof movies.$inferSelect> {
	const tmdbId = parseInt(media.tmdbId, 10);

	// Try by tmdbId first (fast path after first visit)
	if (!isNaN(tmdbId)) {
		const existing = await db.query.movies.findFirst({ where: eq(movies.tmdbId, tmdbId) });
		if (existing) {
			// Rows seeded from the Bechdel CSV only have an imdbId; tmdbId gets written the first
			// time someone browses to the movie page. If that same row was later found via tmdbId
			// it means we already have the tmdbId, but the imdbId may still be null if TMDB didn't
			// return one at seed time. Writing it now means the next lookup can skip this branch.
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
			// Rows seeded from the Bechdel CSV are inserted with only an imdbId; tmdbId is null
			// because the CSV has no TMDB data. Without this backfill, every subsequent page visit
			// would fall through the tmdbId fast-path (no match), hit this imdbId branch again,
			// and never benefit from the cheaper numeric-column lookup.
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
 *
 * @param media - Media descriptor; for TV the tmdbId is zeroed out to prevent collisions.
 * @param kind - `'tv'` applies a synthetic `tmdb-tv:` imdbId namespace; `'movie'` delegates unchanged.
 * @returns The found or newly created `movies` row.
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

/**
 * Fetches the Bechdel Test rating row for a movie, if one exists in the DB.
 *
 * @param movieId - UUID of the `movies` row.
 * @returns The `movie_bechdel` row, or `null` if the movie has no seeded rating.
 */
export async function getBechdel(movieId: string): Promise<BechdelData | null> {
	return (
		(await db.query.movieBechdel.findFirst({ where: eq(movieBechdel.movieId, movieId) })) ?? null
	);
}

/**
 * Fetches the Unconsenting Media binding for a movie, if a seeded match exists.
 *
 * @param movieId - UUID of the `movies` row.
 * @returns The `movie_unconsenting` row with sexual-violence flags, or `null` if not seeded.
 */
export async function getUnconsenting(movieId: string): Promise<UnconsentingData | null> {
	return (
		(await db.query.movieUnconsenting.findFirst({
			where: eq(movieUnconsenting.movieId, movieId)
		})) ?? null
	);
}

