import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PublicUser } from '#lib/media/types/user.ts';

vi.mock('$app/env', () => ({ browser: true }));

const { Session } = await import('#lib/media/utils/session.svelte.js');

const MARY: PublicUser = {
	id: 'user-1',
	username: 'mary',
	avatarKey: null,
	role: 'user',
	displayName: 'mary'
};

function respond(body: PublicUser | null, ok = true) {
	return vi.fn(async () => ({ ok, json: async () => body }) as Response);
}

/** A fetch that stays pending until the test releases it. */
function deferred(body: PublicUser | null) {
	let release!: () => void;
	const gate = new Promise<void>((r) => (release = r));
	const fetcher = vi.fn(async () => {
		await gate;
		return { ok: true, json: async () => body } as Response;
	});
	return { fetcher, release };
}

function clearCookies() {
	for (const c of document.cookie.split(';')) {
		const name = c.split('=')[0].trim();
		if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
	}
}

function hint(): string | undefined {
	return document.cookie
		.split(';')
		.map((c) => c.trim().split('='))
		.find(([name]) => name === 'midb_hint')?.[1];
}

describe('Session', () => {
	beforeEach(clearCookies);
	afterEach(clearCookies);

	it('starts pending with no hint, so SSR and hydration markup match', () => {
		const s = new Session();
		expect(s.status).toBe('pending');
		expect(s.user).toBeNull();
		expect(s.hint).toBeNull();
		expect(s.likelyUser).toBe(false);
	});

	it('pending → user when /api/me returns a user', async () => {
		const s = new Session();
		await s.load(respond(MARY));
		expect(s.status).toBe('user');
		expect(s.user).toEqual(MARY);
	});

	it('pending → anon when /api/me returns null, fails, or throws', async () => {
		const a = new Session();
		await a.load(respond(null));
		expect(a.status).toBe('anon');

		const b = new Session();
		await b.load(respond(MARY, false));
		expect(b.status).toBe('anon');

		const c = new Session();
		await c.load(vi.fn(async () => Promise.reject(new Error('offline'))));
		expect(c.status).toBe('anon');
		expect(c.user).toBeNull();
	});

	it('fetches once per page load and asks the browser not to cache', async () => {
		const s = new Session();
		const fetcher = respond(MARY);
		await Promise.all([s.load(fetcher), s.load(fetcher)]);
		await s.load(fetcher);
		expect(fetcher).toHaveBeenCalledOnce();
		expect(fetcher).toHaveBeenCalledWith('/api/me', { cache: 'no-store' });
	});

	it('refresh reads /api/me again after a sign-in made without a page load', async () => {
		const s = new Session();
		await s.load(respond(null));
		expect(s.status).toBe('anon');
		await s.refresh(respond(MARY));
		expect(s.status).toBe('user');
		expect(s.user).toEqual(MARY);
		expect(hint()).toBe('1');
	});

	it('hints "user" from the midb_hint cookie while the fetch is pending', async () => {
		document.cookie = 'theme=dark';
		document.cookie = 'midb_hint=1';
		const s = new Session();
		const { fetcher, release } = deferred(MARY);
		const done = s.load(fetcher);
		expect(s.status).toBe('pending');
		expect(s.hint).toBe('user');
		expect(s.likelyUser).toBe(true);
		release();
		await done;
		expect(s.status).toBe('user');
	});

	it('keeps the data-hint attribute on the root in step with the sign-in state', async () => {
		const s = new Session();
		s.set(MARY);
		expect(document.documentElement.dataset.hint).toBe('user');
		s.clear();
		expect(document.documentElement.dataset.hint).toBeUndefined();
	});

	it('hints "anon" without the cookie, and ignores look-alike cookie names and values', async () => {
		document.cookie = 'xmidb_hint=1';
		document.cookie = 'midb_hint=0';
		const s = new Session();
		const { fetcher, release } = deferred(null);
		const done = s.load(fetcher);
		expect(s.hint).toBe('anon');
		expect(s.likelyUser).toBe(false);
		release();
		await done;
		expect(s.status).toBe('anon');
	});

	it('sets the hint when /api/me returns a user, and when layout data sets one', async () => {
		const a = new Session();
		await a.load(respond(MARY));
		expect(hint()).toBe('1');

		clearCookies();
		new Session().set(MARY);
		expect(hint()).toBe('1');
	});

	it('clears the hint when /api/me returns null, and on clear()', async () => {
		document.cookie = 'midb_hint=1';
		await new Session().load(respond(null));
		expect(hint()).toBeUndefined();

		document.cookie = 'midb_hint=1';
		new Session().clear();
		expect(hint()).toBeUndefined();
	});

	it('keeps the hint when /api/me could not answer', async () => {
		document.cookie = 'midb_hint=1';
		await new Session().load(respond(null, false));
		expect(hint()).toBe('1');

		await new Session().load(vi.fn(async () => Promise.reject(new Error('offline'))));
		expect(hint()).toBe('1');
	});

	it('set() from /user/* layout data wins over a slower /api/me response', async () => {
		const s = new Session();
		const { fetcher, release } = deferred(null);
		const done = s.load(fetcher);
		s.set(MARY);
		expect(s.status).toBe('user');
		release();
		await done;
		expect(s.status).toBe('user');
		expect(s.user).toEqual(MARY);
	});

	it('skips the fetch when /user/* layout data already set the user', async () => {
		const s = new Session();
		s.set(MARY);
		const fetcher = respond(null);
		await s.load(fetcher);
		expect(fetcher).not.toHaveBeenCalled();
		expect(s.status).toBe('user');
	});

	it('clear() on logout signs out and drops an in-flight response', async () => {
		const s = new Session();
		const { fetcher, release } = deferred(MARY);
		const done = s.load(fetcher);
		s.clear();
		release();
		await done;
		expect(s.status).toBe('anon');
		expect(s.user).toBeNull();
		expect(s.likelyUser).toBe(false);
	});
});
