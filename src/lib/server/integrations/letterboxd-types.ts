export interface LetterboxdResult {
	/** The film's average rating on Letterboxd, 0–5. */
	rating: number;
	/** How many ratings the average rests on; null when the statistics do not say. */
	ratingCount: number | null;
	/** The film's page on Letterboxd. */
	url: string;
}

/** A lookup's answer: the rating, null when Letterboxd has none, `'failed'` when the lookup failed. */
export type LetterboxdOutcome = LetterboxdResult | null | 'failed';
