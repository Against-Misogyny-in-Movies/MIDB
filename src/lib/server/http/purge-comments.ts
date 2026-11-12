import { cache, waitUntil } from 'cloudflare:workers';
import { commentsTag } from './cache.ts';

/**
 * Purges a title's edge-cached comment list (`commentsTag`) after the response (`waitUntil`).
 * A title with no TMDB id has no list to purge. A failed purge is logged and swallowed: the
 * write has already succeeded, and the list's short edge TTL (`PUBLIC_COMMENTS`) bounds how
 * long it can stay stale.
 */
export function purgeTitleComments(title: { kind: string; tmdbId: number | string | null }): void {
	if (title.tmdbId === null) return;
	const tags = [commentsTag(title.kind, title.tmdbId)];
	waitUntil(
		(async () => {
			try {
				const result = await cache.purge({ tags });
				if (!result.success) console.error('[comments] cache purge failed', result.errors);
			} catch (err) {
				console.error('[comments] cache purge failed', err);
			}
		})()
	);
}
