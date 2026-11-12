import { cache, waitUntil } from 'cloudflare:workers';

/**
 * Purges the edge-cached comment lists with these tags (`commentsTag`), after the response
 * (`waitUntil`). A failed purge is logged and swallowed: the write has already succeeded, and the
 * list's short edge TTL (`PUBLIC_COMMENTS`) bounds how long it can stay stale.
 */
export function purgeComments(tags: readonly string[]): void {
	const unique = [...new Set(tags)];
	if (unique.length === 0) return;
	waitUntil(
		(async () => {
			try {
				const result = await cache.purge({ tags: unique });
				if (!result.success) console.error('[comments] cache purge failed', result.errors);
			} catch (err) {
				console.error('[comments] cache purge failed', err);
			}
		})()
	);
}
