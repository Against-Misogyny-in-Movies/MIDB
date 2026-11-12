import { getAuth } from '#lib/server/auth/auth.ts';
import { PRIVATE_NO_STORE } from '#lib/server/http/cache.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';
import type { RequestHandler } from './$types';

/**
 * Better Auth's endpoints (sign-in, passkeys, social callbacks, sessions), all under
 * `/api/auth`. Rate-limited per IP, outside any `try` so the 429 reaches the client. The
 * response is private: it carries cookies and per-user state.
 */
const handle: RequestHandler = async (event) => {
	await rateLimit(event, 'RL_AUTH');
	const response = await getAuth().handler(event.request);
	// A response from `handler` may have immutable headers; copy it before changing them.
	const out = new Response(response.body, response);
	for (const [name, value] of Object.entries(PRIVATE_NO_STORE)) out.headers.set(name, value);
	return out;
};

export const GET = handle;
export const POST = handle;
