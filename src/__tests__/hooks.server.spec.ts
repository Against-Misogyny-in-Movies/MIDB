import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { JWTPayload } from 'jose';
import type { UserRow } from '#lib/server/data/user-queries.ts';

const verifyClaims = vi.fn<() => Promise<JWTPayload | null>>();
const getOrCreateUser = vi.fn<() => Promise<UserRow>>();

vi.mock('#lib/server/auth/hanko.ts', () => ({
	verifyClaims: () => verifyClaims(),
	emailFromClaims: () => 'mary@example.com'
}));
vi.mock('#lib/server/data/user-queries.ts', () => ({
	getOrCreateUser: () => getOrCreateUser()
}));

const { handle } = await import('../hooks.server');

function event(pathname: string): RequestEvent {
	return {
		url: new URL(`http://localhost${pathname}`),
		locals: {} as App.Locals
	} as RequestEvent;
}

async function run(pathname: string) {
	const ev = event(pathname);
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
		verifyClaims.mockReset();
		getOrCreateUser.mockReset();
	});

	it('never resolves the user on a public page, even when signed in', async () => {
		verifyClaims.mockResolvedValue({ sub: 'sub-1' });
		const { ev, resolve, error } = await run('/movie/1');
		expect(error).toBeNull();
		expect(resolve).toHaveBeenCalledOnce();
		expect(ev.locals.claims).toEqual({ sub: 'sub-1' });
		expect(getOrCreateUser).not.toHaveBeenCalled();
	});

	it('memoises getUser: one DB call per request', async () => {
		verifyClaims.mockResolvedValue({ sub: 'sub-1' });
		getOrCreateUser.mockResolvedValue({ id: 'sub-1', role: 'user' } as UserRow);
		const { ev } = await run('/movie/1');
		await Promise.all([ev.locals.getUser(), ev.locals.getUser()]);
		await ev.locals.getUser();
		expect(getOrCreateUser).toHaveBeenCalledOnce();
	});

	it('getUser is null without claims and never touches the DB', async () => {
		verifyClaims.mockResolvedValue(null);
		const { ev } = await run('/');
		await expect(ev.locals.getUser()).resolves.toBeNull();
		expect(getOrCreateUser).not.toHaveBeenCalled();
	});

	it.each(['/user', '/user/x', '/user/profile'])(
		'redirects %s to /auth without claims, with no DB access and never cached',
		async (path) => {
			verifyClaims.mockResolvedValue(null);
			const ev = event(path);
			const resolve = vi.fn(async () => new Response('ok'));
			const res = await handle({ event: ev, resolve });
			expect(res.status).toBe(303);
			expect(res.headers.get('location')).toBe('/auth');
			expect(res.headers.get('cache-control')).toBe('private, no-store');
			expect(resolve).not.toHaveBeenCalled();
			expect(getOrCreateUser).not.toHaveBeenCalled();
		}
	);

	it('gates /user/* on claims only: signed-in requests pass without a DB read', async () => {
		verifyClaims.mockResolvedValue({ sub: 'sub-1' });
		const { error, resolve } = await run('/user/profile');
		expect(error).toBeNull();
		expect(resolve).toHaveBeenCalledOnce();
		expect(getOrCreateUser).not.toHaveBeenCalled();
	});

	it.each(['/users', '/users/42', '/username'])('does not gate %s', async (path) => {
		verifyClaims.mockResolvedValue(null);
		const { error, resolve } = await run(path);
		expect(error).toBeNull();
		expect(resolve).toHaveBeenCalledOnce();
	});

	it('answers 403 on /user/moderation for role user, never cached', async () => {
		verifyClaims.mockResolvedValue({ sub: 'sub-1' });
		getOrCreateUser.mockResolvedValue({ id: 'sub-1', role: 'user' } as UserRow);
		const resolve = vi.fn(async () => new Response('ok'));
		const res = await handle({ event: event('/user/moderation'), resolve });
		expect(res.status).toBe(403);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(resolve).not.toHaveBeenCalled();
	});

	it('redirects /user/moderation to /auth when the user row is missing, never cached', async () => {
		verifyClaims.mockResolvedValue({ sub: 'sub-1' });
		getOrCreateUser.mockResolvedValue(null as unknown as UserRow);
		const resolve = vi.fn(async () => new Response('ok'));
		const res = await handle({ event: event('/user/moderation'), resolve });
		expect(res.status).toBe(303);
		expect(res.headers.get('location')).toBe('/auth');
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(resolve).not.toHaveBeenCalled();
	});

	it.each(['moderator', 'administrator'] as const)(
		'lets a %s into /user/moderation',
		async (role) => {
			verifyClaims.mockResolvedValue({ sub: 'sub-1' });
			getOrCreateUser.mockResolvedValue({ id: 'sub-1', role } as UserRow);
			const { error, resolve } = await run('/user/moderation/queue');
			expect(error).toBeNull();
			expect(resolve).toHaveBeenCalledOnce();
		}
	);
});

describe('handle cache headers', () => {
	async function respond(init: Response) {
		verifyClaims.mockResolvedValue(null);
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
