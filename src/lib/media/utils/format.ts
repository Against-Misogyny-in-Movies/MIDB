const currencyFormatter = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	maximumFractionDigits: 0
});

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

/**
 * Formats a number as a USD currency string with no decimal places.
 * Returns an em-dash for falsy values (0, null, undefined).
 *
 * @param n - The amount in USD.
 * @returns Formatted string (e.g. `"$63,000,000"`) or `"—"` for zero/falsy input.
 */
export function formatCurrency(n: number): string {
	if (!n) return '—';
	return currencyFormatter.format(n);
}

/**
 * Resolves an ISO 3166-1 alpha-2 country code to its English display name.
 * Falls back to the raw code if the code is unrecognized or Intl throws.
 *
 * @param iso - ISO 3166-1 alpha-2 code (e.g. `"US"`).
 * @returns The English country name, or the raw code if unresolvable.
 */
export function countryName(iso: string): string {
	try {
		return countryNames.of(iso) ?? iso;
	} catch {
		return iso;
	}
}

/**
 * Resolves a BCP 47 language code to its English display name.
 * Returns `fallback` (or the raw code) when the code is unrecognized or
 * Intl returns the code back unchanged (which TMDB occasionally triggers with `"cn"`).
 *
 * @param iso - BCP 47 language tag (e.g. `"en"`, `"fr"`).
 * @param fallback - Optional human-readable name to use when resolution fails.
 * @returns The English language name, or `fallback` / raw code as a last resort.
 */
export function languageName(iso: string, fallback?: string): string {
	try {
		const resolved = languageNames.of(iso);
		// If Intl returned the raw code unchanged, it didn't recognize it — use fallback
		if (!resolved || resolved === iso) return fallback ?? iso;
		return resolved;
	} catch {
		return fallback ?? iso;
	}
}

/**
 * Converts a runtime in minutes to a human-readable string.
 * Returns an em-dash for zero or falsy input.
 *
 * @param min - Duration in minutes.
 * @returns Formatted string like `"2h 19m"`, `"45m"`, `"1h"`, or `"—"` for zero.
 */
export function formatRuntime(min: number): string {
	if (!min) return '—';
	const h = Math.floor(min / 60);
	const m = min % 60;
	if (h === 0) return `${m}m`;
	if (m === 0) return `${h}h`;
	return `${h}h ${m}m`;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
	year: 'numeric',
	month: 'long',
	day: 'numeric',
	timeZone: 'UTC'
});

/**
 * Formats a TMDB `YYYY-MM-DD` date as `May 13, 2015`. Read in UTC, so the server and every
 * browser render the same day. Returns an em-dash for an empty or unparseable value.
 *
 * @param iso - A `YYYY-MM-DD` date string, or `''`.
 * @returns The long-form date, or `"—"`.
 */
export function formatDate(iso: string): string {
	if (!iso) return '—';
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC'
});

/**
 * Formats a date as `Nov 14, 2026`, for dense rows (a comment's date, a table cell). Read in
 * UTC like `formatDate`, and an em-dash for an empty or unparseable value.
 *
 * @param iso - An ISO date or date-time string, or `''`.
 * @returns The short date, or `"—"`.
 */
export function formatShortDate(iso: string): string {
	if (!iso) return '—';
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? '—' : shortDateFormatter.format(date);
}

/**
 * Moves a trailing English article to the front. The Bechdel Test year pages (the synced
 * titles) and TMDB give titles in reading order (`"The Matrix"`), which pass through
 * unchanged; a title in library order (`"Matrix, The"`) is reordered.
 *
 * @param title - A title as stored.
 * @returns The title in reading order (`"The Matrix"`); other titles unchanged.
 */
export function displayTitle(title: string): string {
	const m = /^(.+), (The|A|An)$/.exec(title.trim());
	return m ? `${m[2]} ${m[1]}` : title;
}
