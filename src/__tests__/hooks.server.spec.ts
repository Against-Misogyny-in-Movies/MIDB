import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isHttpError, isRedirect, type RequestEvent } from '@sveltejs/kit';
import type { JWTPayload } from 'jose';
import type { UserRow } from '$lib/server/data/user-queries';

const verifyClaims = vi.fn<() => Promise<JWTPayload | null>>();
const getOrCreateUser = vi.fn<() => Promise<UserRow>>();

vi.mock('$lib/server/auth/hanko', () => ({
	verifyClaims: () => verifyClaims(),
	emailFromClaims: () => 'mary@example.com'
}));
vi.mock('$lib/server/data/user-queries', () => ({
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
		'redirects %s to /auth without claims, with no DB access',
		async (path) => {
			verifyClaims.mockResolvedValue(null);
			const { error, resolve } = await run(path);
			expect(isRedirect(error)).toBe(true);
			expect(error).toMatchObject({ status: 303, location: '/auth' });
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

	it('answers 403 on /user/moderation for role user', async () => {
		verifyClaims.mockResolvedValue({ sub: 'sub-1' });
		getOrCreateUser.mockResolvedValue({ id: 'sub-1', role: 'user' } as UserRow);
		const { error, resolve } = await run('/user/moderation');
		expect(isHttpError(error, 403)).toBe(true);
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
