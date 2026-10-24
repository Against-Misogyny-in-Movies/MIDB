import { describe, it, expect, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { UserRow } from '$lib/server/data/user-queries';

vi.mock('$db/connections', () => ({ default: {} }));

const { GET } = await import('../routes/api/me/+server');

function call(user: UserRow | null) {
	const event = {
		locals: { claims: user ? { sub: user.id } : null, getUser: async () => user }
	} as unknown as RequestEvent;
	return GET(event as Parameters<typeof GET>[0]);
}

describe('GET /api/me', () => {
	it('returns null with private, no-store when signed out', async () => {
		const res = await call(null);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		await expect(res.json()).resolves.toBeNull();
	});

	it('returns a PublicUser (no email, no id) with private, no-store', async () => {
		const res = await call({
			id: 'hanko-sub-1',
			email: 'mary@example.com',
			role: 'moderator',
			username: null,
			avatarKey: 'kahlo',
			createdAt: new Date(),
			updatedAt: new Date()
		} as UserRow);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		const body = await res.json();
		expect(body).toEqual({
			username: null,
			avatarKey: 'kahlo',
			role: 'moderator',
			displayName: 'mary'
		});
		expect(JSON.stringify(body)).not.toMatch(/example\.com|hanko-sub-1/);
	});
});
