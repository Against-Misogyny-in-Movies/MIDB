import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	current: vi.fn(),
	list: vi.fn(),
	endOthers: vi.fn(),
	end: vi.fn(),
	rateLimit: vi.fn()
}));

vi.mock('#lib/server/auth/current-session.ts', () => ({ currentSessionId: mocks.current }));
vi.mock('#lib/server/data/sessions.ts', () => ({
	listLiveSessions: mocks.list,
	endOtherSessions: mocks.endOthers,
	endSession: mocks.end
}));
vi.mock('#lib/server/http/rate-limit.ts', () => ({ rateLimit: mocks.rateLimit }));

const list = await import('../+server.ts');
const one = await import('../[id]/+server.ts');

const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0';
const user = { id: 'anna-id', role: 'user' };

const event = (u: unknown, params: Record<string, string> = {}) =>
	({
		locals: { getUser: async () => u },
		request: new Request('http://localhost/api/me/sessions'),
		params
	}) as never;

beforeEach(() => {
	vi.resetAllMocks();
	mocks.rateLimit.mockResolvedValue(undefined);
	mocks.current.mockResolvedValue('s-2');
	mocks.list.mockResolvedValue([
		{ id: 's-1', userAgent: FIREFOX, createdAt: new Date('2026-11-10T10:00:00Z') },
		{ id: 's-2', userAgent: null, createdAt: new Date('2026-11-01T10:00:00Z') }
	]);
});

describe('GET /api/me/sessions', () => {
	it('lists the sessions, the asking one first, private, with no token or IP address', async () => {
		const response = await list.GET(event(user));
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(await response.json()).toEqual([
			{
				id: 's-2',
				label: 'Unknown device',
				mobile: false,
				startedAt: '2026-11-01T10:00:00.000Z',
				current: true
			},
			{
				id: 's-1',
				label: 'Firefox on Linux',
				mobile: false,
				startedAt: '2026-11-10T10:00:00.000Z',
				current: false
			}
		]);
		expect(mocks.rateLimit).toHaveBeenCalledWith(expect.anything(), 'RL_SESSIONS', {
			userId: 'anna-id'
		});
	});

	it('is 401 signed out, and when the asking session has ended', async () => {
		await expect(list.GET(event(null))).rejects.toMatchObject({ status: 401 });
		mocks.current.mockResolvedValue(null);
		await expect(list.GET(event(user))).rejects.toMatchObject({ status: 401 });
		expect(mocks.list).not.toHaveBeenCalled();
	});

	it('skips the limit for staff', async () => {
		await list.GET(event({ ...user, role: 'moderator' }));
		expect(mocks.rateLimit).not.toHaveBeenCalled();
	});
});

describe('DELETE /api/me/sessions', () => {
	it('ends every session but the asking one', async () => {
		const response = await list.DELETE(event(user));
		expect(response.status).toBe(204);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(mocks.endOthers).toHaveBeenCalledWith('anna-id', 's-2');
	});

	it('ends nothing signed out or from an ended session, and is limited', async () => {
		await expect(list.DELETE(event(null))).rejects.toMatchObject({ status: 401 });
		mocks.current.mockResolvedValue(null);
		await expect(list.DELETE(event(user))).rejects.toMatchObject({ status: 401 });
		expect(mocks.endOthers).not.toHaveBeenCalled();
		mocks.rateLimit.mockRejectedValue({ status: 429 });
		mocks.current.mockResolvedValue('s-2');
		await expect(list.DELETE(event(user))).rejects.toMatchObject({ status: 429 });
		expect(mocks.endOthers).not.toHaveBeenCalled();
	});
});

describe('DELETE /api/me/sessions/[id]', () => {
	it('ends the named session of the account', async () => {
		const response = await one.DELETE(event(user, { id: 's-1' }));
		expect(response.status).toBe(204);
		expect(mocks.end).toHaveBeenCalledWith('anna-id', 's-1');
	});

	it('refuses to end the asking session', async () => {
		await expect(one.DELETE(event(user, { id: 's-2' }))).rejects.toMatchObject({ status: 400 });
		expect(mocks.end).not.toHaveBeenCalled();
	});

	it('is 401 signed out or from an ended session', async () => {
		await expect(one.DELETE(event(null, { id: 's-1' }))).rejects.toMatchObject({ status: 401 });
		mocks.current.mockResolvedValue(null);
		await expect(one.DELETE(event(user, { id: 's-1' }))).rejects.toMatchObject({ status: 401 });
		expect(mocks.end).not.toHaveBeenCalled();
	});
});
