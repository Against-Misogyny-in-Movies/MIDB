import { error, type RequestEvent } from '@sveltejs/kit';
import { incr } from '#lib/server/cache/index.ts';
import { env } from '#lib/server/env.ts';

/** The limits, each a Workers rate-limit binding (`ratelimits` in `wrangler.jsonc`). */
export type RateLimitBucket =
	| 'RL_SEARCH'
	| 'RL_AVAILABILITY'
	| 'RL_AUTH'
	| 'RL_COMMENT'
	| 'RL_VOTE'
	| 'RL_REPORT'
	| 'RL_CONTENT_REPORT'
	| 'RL_MODERATE_AI'
	| 'RL_COMMENT_READ';

/** `wrangler.jsonc`'s `limit` and `period` for each bucket, for the memory fallback. */
const FALLBACK_LIMITS: Record<RateLimitBucket, { limit: number; windowMs: number }> = {
	RL_SEARCH: { limit: 60, windowMs: 60_000 },
	RL_AVAILABILITY: { limit: 30, windowMs: 60_000 },
	RL_AUTH: { limit: 30, windowMs: 60_000 },
	RL_COMMENT: { limit: 5, windowMs: 60_000 },
	RL_VOTE: { limit: 30, windowMs: 60_000 },
	RL_REPORT: { limit: 10, windowMs: 60_000 },
	RL_CONTENT_REPORT: { limit: 10, windowMs: 60_000 },
	RL_MODERATE_AI: { limit: 10, windowMs: 60_000 },
	RL_COMMENT_READ: { limit: 60, windowMs: 60_000 }
};

/** True when the client is within the bucket's limit. Fails open if the binding errors. */
async function withinLimit(bucket: RateLimitBucket, client: string): Promise<boolean> {
	const binding: RateLimit | undefined = env[bucket];
	if (binding) {
		try {
			const { success } = await binding.limit({ key: client });
			return success;
		} catch (err) {
			// A limiter outage must not turn into 429s for everyone.
			console.error('[rate-limit] binding failed', err);
			return true;
		}
	}
	const { limit, windowMs } = FALLBACK_LIMITS[bucket];
	return (await incr(`rl:${bucket}:${client}`, windowMs)) <= limit;
}

/**
 * Rate-limits a client in `bucket`, throwing `error(429)` once it is over the limit. The
 * limit and its window are the binding's (`wrangler.jsonc`).
 *
 * The client is the user when the caller passes `userId` (a route that already ran
 * `requireUser`), else the IP from `event.getClientAddress()`. It never reads the user
 * itself: on a public, CDN-cached route (`PUBLIC_PAGE`, `/api/search`) the response must
 * not depend on who is asking, so those key on the IP only.
 *
 * The Workers binding counts per location and is eventually consistent, so the limit is
 * approximate. Where the bucket has no binding (`pnpm dev` without one, unit tests) the
 * memory counters apply (`cache/index.ts`, `incr`) with the same numbers: a fixed window per
 * isolate. If the binding fails, the request is let through (fail open).
 *
 * @param event - The request; only `getClientAddress` is used.
 * @param bucket - Names the binding, e.g. `RL_SEARCH`. Each bucket counts separately.
 * @param who.userId - Key on this user instead of the IP.
 * @throws SvelteKit `error(429)` once the client is over the limit.
 */
export async function rateLimit(
	event: Pick<RequestEvent, 'getClientAddress'>,
	bucket: RateLimitBucket,
	{ userId }: { userId?: string } = {}
): Promise<void> {
	const client = userId ? `user:${userId}` : `ip:${event.getClientAddress()}`;
	if (!(await withinLimit(bucket, client))) error(429, 'Too many requests');
}
