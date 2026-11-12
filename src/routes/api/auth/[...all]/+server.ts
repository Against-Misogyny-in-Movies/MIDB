import { getAuth } from '#lib/server/auth/auth.ts';
import { asPrivate } from '#lib/server/http/cache.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';
import type { RequestHandler } from './$types';

/**
 * Better Auth's endpoints (sign-in, passkeys, social callbacks, sessions), all under
 * `/api/auth`. Rate-limited per IP, outside any `try` so the 429 reaches the client. The
 * response is private: it carries cookies and per-user state.
 */
const handle: RequestHandler = async (event) => {
	await rateLimit(event, 'RL_AUTH');
	return asPrivate(await getAuth().handler(event.request));
};

export const GET = handle;
export const POST = handle;
