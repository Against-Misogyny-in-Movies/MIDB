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
