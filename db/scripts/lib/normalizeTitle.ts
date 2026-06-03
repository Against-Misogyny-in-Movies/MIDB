const LEADING_ARTICLES = /^(the|a|an|le|la|les|los|las|el|un|une|des|il|lo|gli|i|eine|ein|der|die|das)\s+/i;

/**
 * Normalizes a movie title for fuzzy cross-source matching.
 * Strips leading articles, punctuation, and extra whitespace; lowercases.
 * Must match UM's cleanName/cleanNameArticles conventions.
 */
export function normalizeTitle(title: string): string {
	return title
		.trim()
		.toLowerCase()
		.replace(LEADING_ARTICLES, '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '') // strip diacritics
		.replace(/[^a-z0-9\s]/g, '')     // strip punctuation
		.replace(/\s+/g, ' ')
		.trim();
}
