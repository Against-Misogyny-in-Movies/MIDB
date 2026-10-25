import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { UserRow } from '$lib/server/data/user-queries';

const isUsernameAvailable = vi.fn(async () => true);
vi.mock('$lib/server/data/user-queries', () => ({ isUsernameAvailable }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { GET } = await import('../routes/user/profile/availability/+server');
const { clearCache } = await import('$lib/server/cache');

const user = (id: string) => ({ id, role: 'user' }) as UserRow;

function call(signedIn: UserRow | null, username = 'zed', ip = '203.0.113.7') {
	const event = {
		url: new URL(`http://localhost/user/profile/availability?username=${username}`),
		locals: { claims: signedIn ? { sub: signedIn.id } : null, getUser: async () => signedIn },
		getClientAddress: () => ip
	} as unknown as RequestEvent;
	return GET(event as Parameters<typeof GET>[0]);
}

beforeEach(async () => {
	await clearCache();
	isUsernameAvailable.mockClear();
});

describe('GET /user/profile/availability', () => {
	it('answers availability for a signed-in user', async () => {
		const res = await call(user('alice'));
		await expect(res.json()).resolves.toEqual({ available: true });
		expect(isUsernameAvailable).toHaveBeenCalledWith('zed', 'alice');
	});

	it('401s when signed out, before counting anything', async () => {
		await expect(call(null)).rejects.toMatchObject({ status: 401 });
	});

	it('returns 429 after 30 checks a minute for one user, from any IP; other users are unaffected', async () => {
		for (let i = 0; i < 15; i++) await call(user('alice'), `u${i}`, '203.0.113.7');
		for (let i = 15; i < 30; i++) await call(user('alice'), `u${i}`, '198.51.100.2');
		await expect(call(user('alice'), 'more', '192.0.2.1')).rejects.toMatchObject({ status: 429 });
		expect(isUsernameAvailable).toHaveBeenCalledTimes(30);

		// Same IP as alice, different user: its own budget.
		const res = await call(user('bob'), 'zed', '203.0.113.7');
		await expect(res.json()).resolves.toEqual({ available: true });
	});
});
