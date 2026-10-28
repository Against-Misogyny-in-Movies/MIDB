/**
 * Cache-control policies. One constant per policy keeps them greppable.
 *
 * PUBLIC_PAGE: shared (CDN) caching for user-agnostic pages. A load that sets it must not
 * read the request's user: the edge cache key ignores cookies, so one visitor's response
 * would be served to everyone. The navbar's auth slot hydrates from /api/me instead.
 */
export const PUBLIC_PAGE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

/**
 * PUBLIC_NO_STORE: user-agnostic, but different on every request (the landing's random films),
 * so neither a browser nor the CDN keeps it. The PUBLIC_PAGE rule still applies: never read the
 * request's user in a load that sets it.
 */
export const PUBLIC_NO_STORE = 'no-store';

/** Personalised responses (/api/me, /user/*): never stored by a browser or shared cache. */
export const PRIVATE_NO_STORE = 'private, no-store';

/**
 * /api/search: user-agnostic, so browsers keep a result for a minute and the CDN for ten,
 * matching the server-side TMDB search cache. Repeated queries never reach the function.
 */
export const PUBLIC_SEARCH = 'public, max-age=60, s-maxage=600';
