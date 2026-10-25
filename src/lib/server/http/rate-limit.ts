import { error, type RequestEvent } from '@sveltejs/kit';
import { incr } from '$lib/server/cache';

/**
 * Fixed-window rate limit: allows `limit` requests per `windowMs` per client in `bucket`,
 * then throws `error(429)` until the window (started by the client's first request) ends.
 *
 * The client is the user when the caller passes `userId` (a route that already ran
 * `requireUser`), else the IP from `event.getClientAddress()`. It never reads the user
 * itself: on a public, CDN-cached route (`PUBLIC_PAGE`, `/api/search`) the response must
 * not depend on who is asking, so those key on the IP only.
 *
 * Counters live in the cache backend (`incr`). Without `REDIS_URL` that is this process's
 * memory: each serverless instance counts on its own and a cold start resets it, so the
 * limit is best effort. With `REDIS_URL` the counters are shared and the limit is global.
 * If the backend fails, the request is let through (fail open, like the cache).
 *
 * @param event - The request; only `getClientAddress` is used.
 * @param bucket - Names the limit, e.g. `search`. Each bucket counts separately.
 * @param limit - Requests allowed per window.
 * @param windowMs - Window length in milliseconds.
 * @param who.userId - Key on this user instead of the IP.
 * @throws SvelteKit `error(429)` once the client is over the limit.
 */
export async function rateLimit(
	event: Pick<RequestEvent, 'getClientAddress'>,
	bucket: string,
	limit: number,
	windowMs: number,
	{ userId }: { userId?: string } = {}
): Promise<void> {
	const client = userId ? `user:${userId}` : `ip:${event.getClientAddress()}`;
	const count = await incr(`rl:${bucket}:${client}`, windowMs);
	if (count > limit) error(429, 'Too many requests');
}
