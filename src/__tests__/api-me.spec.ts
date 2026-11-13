import { describe, it, expect, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import type { UserRow } from '#lib/server/data/user-queries.ts';

vi.mock('#lib/server/db.ts', () => ({ db: {} }));

const { GET } = await import('../routes/api/me/+server');

function call(user: UserRow | null) {
	const event = {
		locals: { getUser: async () => user }
	} as unknown as RequestEvent;
	return GET(event as Parameters<typeof GET>[0]);
}

describe('GET /api/me', () => {
	it('returns null with private, no-store when signed out', async () => {
		const res = await call(null);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		await expect(res.json()).resolves.toBeNull();
	});

	it('returns a PublicUser (the opaque id, no email) with private, no-store', async () => {
		const res = await call({
			id: 'user-1',
			name: 'Mary',
			email: 'mary@example.com',
			emailVerified: true,
			image: null,
			role: 'moderator',
			username: 'mary_wollstonecraft_0427',
			avatarKey: 'kahlo',
			bannedAt: null,
			banReason: null,
			mutedUntil: null,
			usernameChangedAt: null,
			createdAt: new Date(),
			updatedAt: new Date()
		});
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		const body = await res.json();
		expect(body).toEqual({
			id: 'user-1',
			username: 'mary_wollstonecraft_0427',
			avatarKey: 'kahlo',
			role: 'moderator',
			displayName: 'mary_wollstonecraft_0427'
		});
		expect(JSON.stringify(body)).not.toMatch(/example\.com/);
	});
});
