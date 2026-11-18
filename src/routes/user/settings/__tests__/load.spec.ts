import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE_SESSION_MAX_AGE_MINUTES } from '#lib/media/utils/accountDeletion.ts';

const requireUser = vi.hoisted(() => vi.fn());
const currentSession = vi.hoisted(() => vi.fn());
vi.mock('#lib/server/auth/guards.ts', () => ({ requireUser }));
vi.mock('#lib/server/auth/current-session.ts', () => ({ currentSession }));
vi.mock('#lib/server/auth/providers.ts', () => ({
	configuredProviders: () => ({ google: true, discord: false })
}));
vi.mock('#lib/server/data/sessions.ts', () => ({ countLiveSessions: async () => 2 }));
vi.mock('#lib/server/data/sign-in-methods.ts', () => ({
	getSignInMethodCounts: async () => ({ linked: ['google'], passkeys: 1 })
}));
vi.mock('#lib/server/data/user-queries.ts', () => ({
	toPublicUser: vi.fn(),
	updateProfile: vi.fn()
}));

const { load } = await import('../+page.server.ts');

const request = new Request('http://localhost/user/settings');
const run = () => load({ locals: {}, request } as Parameters<typeof load>[0]);
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

beforeEach(() => {
	requireUser.mockReset();
	requireUser.mockResolvedValue({ id: 'u1', email: 'ada@example.org' });
	currentSession.mockReset();
});

describe('the settings load, sessionRecent', () => {
	it('is true for a session that started within the limit', async () => {
		currentSession.mockResolvedValue({
			id: 's1',
			startedAt: minutesAgo(DELETE_SESSION_MAX_AGE_MINUTES - 1)
		});
		expect(await run()).toMatchObject({ sessionRecent: true });
	});

	it('is false for an older session', async () => {
		currentSession.mockResolvedValue({
			id: 's1',
			startedAt: minutesAgo(DELETE_SESSION_MAX_AGE_MINUTES + 1)
		});
		expect(await run()).toMatchObject({ sessionRecent: false });
	});

	it('is false when the asking session has ended', async () => {
		currentSession.mockResolvedValue(null);
		expect(await run()).toMatchObject({ sessionRecent: false });
	});

	it('reads the session of the signed-in account and sends no start time or id to the client', async () => {
		currentSession.mockResolvedValue({ id: 's1', startedAt: minutesAgo(1) });
		const data = await run();
		expect(currentSession).toHaveBeenCalledWith(request, 'u1');
		expect(JSON.stringify(data)).not.toContain('s1');
		expect(JSON.stringify(data)).not.toContain('startedAt');
	});
});
