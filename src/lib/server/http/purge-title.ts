import { cache, waitUntil } from 'cloudflare:workers';
import { commentsTag, communityReportsTag } from './cache.ts';

type PurgeTitle = { kind: string; tmdbId: number | string | null };

/** The tags one purge request carries; a longer list goes in several requests. */
export const PURGE_TAGS_PER_REQUEST = 30;

/**
 * Purges edge cache tags after the response (`waitUntil`), in one request for the tags given. A
 * failed purge is logged under `label` and swallowed: the write has already succeeded, and the
 * short edge TTL of the policy that set the tag bounds how long the entry can stay stale.
 */
function purgeTags(label: string, tags: string[]): void {
	waitUntil(
		(async () => {
			try {
				const result = await cache.purge({ tags });
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
	purgeTags('comments', [commentsTag(title.kind, title.tmdbId)]);
}

/**
 * Purges a title's edge-cached community-report counts (`communityReportsTag`). A title with no TMDB
 * id has none to purge; `PUBLIC_COMMUNITY_REPORTS` bounds a failed purge.
 */
export function purgeTitleReports(title: PurgeTitle): void {
	if (title.tmdbId === null) return;
	purgeTags('community-reports', [communityReportsTag(title.kind, title.tmdbId)]);
}

/**
 * Purges the community-report counts of several titles, `PURGE_TAGS_PER_REQUEST` tags to a
 * request. Titles with no TMDB id have none to purge.
 */
export function purgeTitlesReports(titles: PurgeTitle[]): void {
	const tags = titles.flatMap((t) =>
		t.tmdbId === null ? [] : [communityReportsTag(t.kind, t.tmdbId)]
	);
	for (let i = 0; i < tags.length; i += PURGE_TAGS_PER_REQUEST) {
		purgeTags('community-reports', tags.slice(i, i + PURGE_TAGS_PER_REQUEST));
	}
}
