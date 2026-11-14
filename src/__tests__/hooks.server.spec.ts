import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { UserRow } from '#lib/server/data/user-queries.ts';

type Session = { user: { id: string } } | null;

const getSession = vi.fn<(args: { headers: Headers }) => Promise<Session>>();
const getUserById = vi.fn<(id: string) => Promise<UserRow | null>>();

vi.mock('#lib/server/auth/auth.ts', () => ({
	getAuth: () => ({ api: { getSession: (args: { headers: Headers }) => getSession(args) } })
}));
vi.mock('#lib/server/data/user-queries.ts', () => ({
	getUserById: (id: string) => getUserById(id)
}));

const { handle } = await import('../hooks.server');
const { commentsHeaders } = await import('#lib/server/http/cache.ts');

const SESSION_COOKIE = 'better-auth.session_token=abc.def';

function event(pathname: string, cookie?: string): RequestEvent {
	return {
		url: new URL(`http://localhost${pathname}`),
		request: new Request(`http://localhost${pathname}`, {
			headers: cookie ? { cookie } : {}
		}),
		locals: {} as App.Locals
	} as RequestEvent;
}

const row = (overrides: Partial<UserRow> = {}) =>
	({ id: 'user-1', role: 'user', bannedAt: null, ...overrides }) as UserRow;

async function run(pathname: string, cookie?: string) {
	const ev = event(pathname, cookie);
	const resolve = vi.fn(async () => new Response('ok'));
	try {
		await handle({ event: ev, resolve });
		return { ev, resolve, error: null as unknown };
	} catch (e) {
		return { ev, resolve, error: e };
	}
}

describe('handle', () => {
	beforeEach(() => {
		getSession.mockReset();
		getUserById.mockReset();
	});

	it('never resolves the user on a public page, even with a session cookie', async () => {
		const { ev, resolve, error } = await run('/movie/1', SESSION_COOKIE);
		expect(error).toBeNull();
		expect(resolve).toHaveBeenCalledOnce();
		expect(ev.locals).not.toHaveProperty('claims');
		expect(getSession).not.toHaveBeenCalled();
		expect(getUserById).not.toHaveBeenCalled();
	});

	it('memoises getUser: one session read and one row read per request', async () => {
		getSession.mockResolvedValue({ user: { id: 'user-1' } });
		getUserById.mockResolvedValue(row());
		const { ev } = await run('/api/me', SESSION_COOKIE);
		await Promise.all([ev.locals.getUser(), ev.locals.getUser()]);
		await ev.locals.getUser();
		expect(getSession).toHaveBeenCalledOnce();
		expect(getUserById).toHaveBeenCalledOnce();
	});

	it('reads the session from the request headers', async () => {
		getSession.mockResolvedValue({ user: { id: 'user-1' } });
		getUserById.mockResolvedValue(row());
		const { ev } = await run('/api/me', SESSION_COOKIE);
		await ev.locals.getUser();
		expect(getSession.mock.calls[0][0].headers.get('cookie')).toBe(SESSION_COOKIE);
	});

	it('getUser is null without a session and never reads the row', async () => {
		getSession.mockResolvedValue(null);
		const { ev } = await run('/');
		await expect(ev.locals.getUser()).resolves.toBeNull();
		expect(getUserById).not.toHaveBeenCalled();
	});

	it('getUser is null when the session names a user that no longer exists', async () => {
		getSession.mockResolvedValue({ user: { id: 'user-1' } });
		getUserById.mockResolvedValue(null);
		const { ev } = await run('/api/me', SESSION_COOKIE);
		await expect(ev.locals.getUser()).resolves.toBeNull();
	});

	it('getUser is null for a banned user, even while the session cookie is cached', async () => {
		getSession.mockResolvedValue({ user: { id: 'user-1' } });
		getUserById.mockResolvedValue(row({ bannedAt: new Date() }));
		const { ev } = await run('/api/me', SESSION_COOKIE);
		await expect(ev.locals.getUser()).resolves.toBeNull();
	});

	it.each(['/user', '/user/x', '/user/profile'])(
		'redirects %s to /auth without a session cookie, with no auth call and never cached',
		async (path) => {
			const ev = event(path);
			const resolve = vi.fn(async () => new Response('ok'));
			const res = await handle({ event: ev, resolve });
			expect(res.status).toBe(303);
			expect(res.headers.get('location')).toBe('/auth');
			expect(res.headers.get('cache-control')).toBe('private, no-store');
			expect(resolve).not.toHaveBeenCalled();
			expect(getSession).not.toHaveBeenCalled();
			expect(getUserById).not.toHaveBeenCalled();
		}
	);

	it.each(['better-auth.session_token=abc', '__Secure-better-auth.session_token=abc'])(
		'gates /user/* on the cookie only: %s passes without a session or row read',
		async (cookie) => {
			const { error, resolve } = await run('/user/profile', cookie);
			expect(error).toBeNull();
			expect(resolve).toHaveBeenCalledOnce();
			expect(getSession).not.toHaveBeenCalled();
			expect(getUserById).not.toHaveBeenCalled();
		}
	);

	it.each(['/users', '/users/42', '/username'])('does not gate %s', async (path) => {
		const { error, resolve } = await run(path);
		expect(error).toBeNull();
		expect(resolve).toHaveBeenCalledOnce();
	});

	it('answers 403 on /user/moderation for role user, never cached', async () => {
		getSession.mockResolvedValue({ user: { id: 'user-1' } });
		getUserById.mockResolvedValue(row());
		const resolve = vi.fn(async () => new Response('ok'));
		const res = await handle({ event: event('/user/moderation', SESSION_COOKIE), resolve });
		expect(res.status).toBe(403);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(resolve).not.toHaveBeenCalled();
	});

	it('redirects /user/moderation to /auth when the session is stale, never cached', async () => {
		getSession.mockResolvedValue(null);
		const resolve = vi.fn(async () => new Response('ok'));
		const res = await handle({ event: event('/user/moderation', SESSION_COOKIE), resolve });
		expect(res.status).toBe(303);
		expect(res.headers.get('location')).toBe('/auth');
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(resolve).not.toHaveBeenCalled();
	});

	it('redirects a banned user away from /user/moderation', async () => {
		getSession.mockResolvedValue({ user: { id: 'user-1' } });
		getUserById.mockResolvedValue(row({ role: 'moderator', bannedAt: new Date() }));
		const resolve = vi.fn(async () => new Response('ok'));
		const res = await handle({ event: event('/user/moderation', SESSION_COOKIE), resolve });
		expect(res.status).toBe(303);
		expect(resolve).not.toHaveBeenCalled();
	});

	it.each(['moderator', 'administrator'] as const)(
		'lets a %s into /user/moderation',
		async (role) => {
			getSession.mockResolvedValue({ user: { id: 'user-1' } });
			getUserById.mockResolvedValue(row({ role }));
			const { error, resolve } = await run('/user/moderation/queue', SESSION_COOKIE);
			expect(error).toBeNull();
			expect(resolve).toHaveBeenCalledOnce();
		}
	);
});

describe('handle cache headers', () => {
	async function respond(init: Response) {
		return handle({ event: event('/x'), resolve: async () => init });
	}

	it('makes a response without cache-control private, no-store', async () => {
		const res = await respond(new Response('ok'));
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});

	it('keeps the cache headers a route set', async () => {
		const res = await respond(
			new Response('ok', {
				headers: { 'cache-control': 'public, max-age=0', 'cdn-cache-control': 'max-age=3600' }
			})
		);
		expect(res.headers.get('cache-control')).toBe('public, max-age=0');
		expect(res.headers.get('cdn-cache-control')).toBe('max-age=3600');
	});

	it("keeps the comment list's public headers and its cache tag", async () => {
		const res = await respond(Response.json([], { headers: commentsHeaders('movie', 348) }));
		expect(res.headers.get('cache-control')).toBe('public, max-age=0');
		expect(res.headers.get('cdn-cache-control')).toBe('max-age=600, stale-while-revalidate=60');
		expect(res.headers.get('cache-tag')).toBe('comments:movie:348');
	});

	it('forces a response that sets a cookie to private, no-store and drops the edge directive', async () => {
		const res = await respond(
			new Response('ok', {
				headers: {
					'cache-control': 'public, max-age=0',
					'cdn-cache-control': 'max-age=3600',
					'cloudflare-cdn-cache-control': 'max-age=3600',
					'set-cookie': 'a=b; Path=/'
				}
			})
		);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(res.headers.has('cdn-cache-control')).toBe(false);
		expect(res.headers.has('cloudflare-cdn-cache-control')).toBe(false);
		expect(res.headers.get('set-cookie')).toBe('a=b; Path=/');
	});

	it('drops the edge directives from a response forced private without a cookie', async () => {
		const res = await respond(
			new Response('ok', {
				headers: {
					'cdn-cache-control': 'max-age=3600',
					'cloudflare-cdn-cache-control': 'max-age=3600'
				}
			})
		);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(res.headers.has('cdn-cache-control')).toBe(false);
		expect(res.headers.has('cloudflare-cdn-cache-control')).toBe(false);
	});

	it('copes with a response whose headers are immutable', async () => {
		const res = await respond(Response.redirect('http://localhost/y', 302));
		expect(res.status).toBe(302);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});
});

describe('handle security headers', () => {
	const EXPECTED = {
		'strict-transport-security': 'max-age=63072000; includeSubDomains',
		'x-content-type-options': 'nosniff',
		'referrer-policy': 'strict-origin-when-cross-origin',
		'x-frame-options': 'DENY',
		'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
		'cross-origin-opener-policy': 'same-origin'
	};

	function expectHeaders(res: Response) {
		for (const [name, value] of Object.entries(EXPECTED)) expect(res.headers.get(name)).toBe(value);
	}

	it('sets them on a resolved response and keeps the one the route set', async () => {
		const res = await handle({
			event: event('/'),
			resolve: async () =>
				new Response('ok', {
					headers: {
						'cache-control': 'public, max-age=0',
						'content-security-policy': "default-src 'self'"
					}
				})
		});
		expectHeaders(res);
		expect(res.headers.get('content-security-policy')).toBe("default-src 'self'");
		expect(res.headers.get('cache-control')).toBe('public, max-age=0');
	});

	it('sets them on a response with immutable headers', async () => {
		const res = await handle({
			event: event('/'),
			resolve: async () => Response.redirect('http://localhost/y', 302)
		});
		expect(res.status).toBe(302);
		expectHeaders(res);
	});

	it('sets them on a response that sets a cookie', async () => {
		const res = await handle({
			event: event('/api/auth/x'),
			resolve: async () => new Response('ok', { headers: { 'set-cookie': 'a=b' } })
		});
		expectHeaders(res);
		expect(res.headers.get('set-cookie')).toBe('a=b');
	});

	it('sets them on the /user cookie gate redirect', async () => {
		const res = await handle({ event: event('/user/profile'), resolve: vi.fn() });
		expect(res.status).toBe(303);
		expectHeaders(res);
	});

	it('sets them on the /user/moderation redirect and error', async () => {
		getSession.mockResolvedValue(null);
		const redirect = await handle({
			event: event('/user/moderation', SESSION_COOKIE),
			resolve: vi.fn()
		});
		expect(redirect.status).toBe(303);
		expectHeaders(redirect);

		getSession.mockResolvedValue({ user: { id: 'user-1' } });
		getUserById.mockResolvedValue(row());
		const forbidden = await handle({
			event: event('/user/moderation', SESSION_COOKIE),
			resolve: vi.fn()
		});
		expect(forbidden.status).toBe(403);
		expectHeaders(forbidden);
	});
});
