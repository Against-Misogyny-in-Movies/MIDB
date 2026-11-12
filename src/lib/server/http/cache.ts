/**
 * Cache policies, one constant per policy so they stay greppable. Each is a header set that a
 * load spreads into `setHeaders` (or a handler into `headers`): the browser's `Cache-Control`
 * plus, where the edge differs, `CDN-Cache-Control`.
 *
 * Cloudflare Workers Caching sits in front of the Worker (`docs/architecture.md`, Caching
 * policy). Its key is path + query, cookies ignored, so a shared response must never depend on
 * the request's user. A `CDN-Cache-Control` header overrides `Cache-Control` at the edge only,
 * and a response with `private`, `no-store` or `Set-Cookie` bypasses it.
 */

/**
 * PUBLIC_PAGE: shared caching for user-agnostic pages (title pages, their `__data.json`,
 * resources). A load that sets it must not read the request's user: one visitor's response
 * would be served to everyone. The navbar's auth slot hydrates from /api/me instead.
 * The browser revalidates on each visit; the edge keeps the page for an hour and serves it
 * stale for a day while it refreshes.
 */
export const PUBLIC_PAGE = {
	'cache-control': 'public, max-age=0',
	'cdn-cache-control': 'max-age=3600, stale-while-revalidate=86400'
};

/**
 * PUBLIC_NO_STORE: user-agnostic, but different on every request (the landing's random films),
 * so neither a browser nor the edge keeps it. The PUBLIC_PAGE rule still applies: never read the
 * request's user in a load that sets it.
 */
export const PUBLIC_NO_STORE = { 'cache-control': 'no-store' };

/** Personalised responses (/api/me, /user/*): never stored by a browser or shared cache. */
export const PRIVATE_NO_STORE = { 'cache-control': 'private, no-store' };

/**
 * /api/search: user-agnostic, so browsers keep a result for a minute and the edge for ten,
 * matching the server-side TMDB search cache. Repeated queries never reach the Worker.
 */
export const PUBLIC_SEARCH = {
	'cache-control': 'max-age=60',
	'cdn-cache-control': 'max-age=600'
};

/**
 * /img/tmdb/*: poster files never change under their name. Thirty days in browser and edge,
 * under TMDB's six-month cap on caching its images.
 */
export const PUBLIC_IMAGE = { 'cache-control': 'public, max-age=2592000' };
