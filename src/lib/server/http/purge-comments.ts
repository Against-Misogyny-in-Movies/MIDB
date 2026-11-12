import { cache, waitUntil } from 'cloudflare:workers';
import { commentsTag, readerReportsTag } from './cache.ts';

type PurgeTitle = { kind: string; tmdbId: number | string | null };

/**
 * Purges one edge cache tag after the response (`waitUntil`). A failed purge is logged under
 * `label` and swallowed: the write has already succeeded, and the short edge TTL of the policy
 * that set the tag bounds how long the entry can stay stale.
 */
function purgeTag(label: string, tag: string): void {
	waitUntil(
		(async () => {
			try {
				const result = await cache.purge({ tags: [tag] });
				if (!result.success) console.error(`[${label}] cache purge failed`, result.errors);
			} catch (err) {
				console.error(`[${label}] cache purge failed`, err);
			}
		})()
	);
}

/**
 * Purges a title's edge-cached comment list (`commentsTag`). A title with no TMDB id has no
 * list to purge; the list's short edge TTL (`PUBLIC_COMMENTS`) bounds a failed purge.
 */
export function purgeTitleComments(title: PurgeTitle): void {
	if (title.tmdbId === null) return;
	purgeTag('comments', commentsTag(title.kind, title.tmdbId));
}

/**
 * Purges a title's edge-cached reader-report counts (`readerReportsTag`). A title with no TMDB
 * id has none to purge; `PUBLIC_READER_REPORTS` bounds a failed purge.
 */
export function purgeTitleReports(title: PurgeTitle): void {
	if (title.tmdbId === null) return;
	purgeTag('reader-reports', readerReportsTag(title.kind, title.tmdbId));
}
