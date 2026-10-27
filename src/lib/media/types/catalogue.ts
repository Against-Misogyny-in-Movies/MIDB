import type { SafetyTier } from '$lib/media/utils/verdict';

/** Size of the two seeded sources (see `$lib/server/data/catalogue.ts`). */
export interface CatalogueCounts {
	bechdelRatings: number;
	umEntries: number;
}

/** One film for the landing page's data card: seeded values only, nothing fetched live. */
export interface RatedFilm {
	/** As stored: library order, e.g. "Matrix, The" (render with `displayTitle`). */
	title: string;
	year: number | null;
	/** Null when the title was never backfilled with a TMDB id. */
	tmdbId: number | null;
	bechdelRating: number;
	/** Null without an Unconsenting Media entry. */
	umConcerns: number | null;
	/** Safety tier from the UM flags alone (the title page also reads Does the Dog Die). */
	umTier: Exclude<SafetyTier, 'unknown'> | null;
}
