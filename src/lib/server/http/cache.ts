/**
 * Cache-control policies. One constant per policy keeps them greppable.
 *
 * PUBLIC_PAGE: shared (CDN) caching for user-agnostic pages. A load that sets it must not
 * read the request's user: the edge cache key ignores cookies, so one visitor's response
 * would be served to everyone. The navbar's auth slot hydrates from /api/me instead.
 */
export const PUBLIC_PAGE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

/** Personalised responses (/api/me, /user/*): never stored by a browser or shared cache. */
export const PRIVATE_NO_STORE = 'private, no-store';
