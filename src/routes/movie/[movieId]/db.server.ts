import { eq } from 'drizzle-orm';
import db from '$db/connections';
import { movies, movieBechdel, movieUnconsenting } from '$db/schema/movie';
import type { Movie } from './types';

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
			cleanTitle: movie.title.toLowerCase().trim(),
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
