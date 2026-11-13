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

/** Personalised responses (/api/me, /api/auth/*, /user/*): never stored by a browser or shared cache. */
export const PRIVATE_NO_STORE = { 'cache-control': 'private, no-store' };

/**
 * A copy of `response` made private: `PRIVATE_NO_STORE` replaces its `Cache-Control`, and the
 * edge directives are dropped, because one would outrank it. The copy is needed because a
 * response from `fetch` or a library has immutable headers.
 */
export function asPrivate(response: Response): Response {
	const out = new Response(response.body, response);
	for (const [name, value] of Object.entries(PRIVATE_NO_STORE)) out.headers.set(name, value);
	out.headers.delete('cdn-cache-control');
	out.headers.delete('cloudflare-cdn-cache-control');
	return out;
}

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

/**
 * PUBLIC_COMMENTS: a title's published comments, the same for everyone. The browser always
 * revalidates; the edge keeps the list for ten minutes and serves it stale for a minute while it
 * refreshes. The response also carries `Cache-Tag: comments:<kind>:<tmdbId>` (`commentsHeaders`),
 * and every comment write or moderation action purges that tag (`purgeTitleComments`), so the
 * list trails a write by at most the purge. Votes do not purge, so a score can trail by up to
 * one TTL.
 */
export const PUBLIC_COMMENTS = {
	'cache-control': 'public, max-age=0',
	'cdn-cache-control': 'max-age=600, stale-while-revalidate=60'
};

/**
 * PUBLIC_READER_REPORTS: a title's reader-report counts, the same for everyone, on the policy of
 * `PUBLIC_COMMENTS`. The response carries `Cache-Tag: reports:<kind>:<tmdbId>`
 * (`readerReportsHeaders`), and every report write purges that tag (`purgeTitleReports`). A
 * report that starts counting on its own (its account reaches the minimum age) does not purge,
 * so the counts can trail by up to one TTL.
 */
export const PUBLIC_READER_REPORTS = PUBLIC_COMMENTS;

/** A per-title cache tag: `<prefix>:<kind>:<tmdbId>`. */
export function titleTag(prefix: string, kind: string, tmdbId: number | string): string {
	return `${prefix}:${kind}:${tmdbId}`;
}

/** A title-scoped policy plus the title's `Cache-Tag`. */
export function titleHeaders(
	policy: Record<string, string>,
	prefix: string,
	kind: string,
	tmdbId: number | string
): Record<string, string> {
	return { ...policy, 'cache-tag': titleTag(prefix, kind, tmdbId) };
}

/** The cache tag shared by one title's comment list. */
export const commentsTag = (kind: string, tmdbId: number | string): string =>
	titleTag('comments', kind, tmdbId);

/** `PUBLIC_COMMENTS` plus the title's `Cache-Tag`, for the list endpoint. */
export const commentsHeaders = (kind: string, tmdbId: number | string): Record<string, string> =>
	titleHeaders(PUBLIC_COMMENTS, 'comments', kind, tmdbId);

/** The cache tag shared by one title's reader-report counts. */
export const readerReportsTag = (kind: string, tmdbId: number | string): string =>
	titleTag('reports', kind, tmdbId);

/** `PUBLIC_READER_REPORTS` plus the title's `Cache-Tag`, for the counts endpoint. */
export const readerReportsHeaders = (
	kind: string,
	tmdbId: number | string
): Record<string, string> => titleHeaders(PUBLIC_READER_REPORTS, 'reports', kind, tmdbId);
