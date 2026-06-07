const LEADING_ARTICLES = /^(the|a|an|le|la|les|los|las|el|un|une|des|il|lo|gli|i|eine|ein|der|die|das)\s+/i;
const TRAILING_YEAR = /\s+((?:19|20)\d{2})$/;

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

/**
 * Strips a trailing year from an already-normalized title key.
 * e.g. "wuthering heights 2026" → { key: "wuthering heights", year: 2026 }
 * If no trailing year, year is null.
 */
export function stripTrailingYear(normalized: string): { key: string; year: number | null } {
	const match = normalized.match(TRAILING_YEAR);
	if (match) {
		return { key: normalized.slice(0, -match[0].length), year: parseInt(match[1], 10) };
	}
	return { key: normalized, year: null };
}
