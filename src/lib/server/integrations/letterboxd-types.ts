export interface LetterboxdResult {
	/** The film's average rating on Letterboxd, 0–5. */
	rating: number;
	/** How many ratings the average rests on; null when the statistics do not say. */
	ratingCount: number | null;
	/** The film's page on Letterboxd. */
	url: string;
}
