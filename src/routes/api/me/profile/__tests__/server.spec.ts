import { describe, expect, it, vi } from 'vitest';

vi.mock('#lib/server/data/own-profile.ts', () => ({
	getOwnProfile: vi.fn(async () => ({ comments: [], reports: [], mutedUntil: null }))
}));

const { GET } = await import('../+server.ts');

const event = (user: unknown) =>
	({ locals: { getUser: async () => user } }) as unknown as Parameters<typeof GET>[0];

describe('GET /api/me/profile', () => {
	it('answers the owner’s view, private and never cached', async () => {
		const response = await GET(event({ id: 'anna-id', mutedUntil: null }));
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(await response.json()).toEqual({ comments: [], reports: [], mutedUntil: null });
	});

	it('is 401 when signed out', async () => {
		await expect(GET(event(null))).rejects.toMatchObject({ status: 401 });
	});
});
