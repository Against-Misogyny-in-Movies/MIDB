import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ build: vi.fn(), rateLimit: vi.fn() }));

vi.mock('#lib/server/data/account-export.ts', () => ({ buildAccountExport: mocks.build }));
vi.mock('#lib/server/http/rate-limit.ts', () => ({ rateLimit: mocks.rateLimit }));

const { GET } = await import('../+server.ts');

const user = { id: 'anna-id', role: 'user', username: 'anna_1234' };
const event = (u: unknown) =>
	({
		locals: { getUser: async () => u },
		request: new Request('http://localhost/api/me/export')
	}) as never;

beforeEach(() => {
	vi.resetAllMocks();
	mocks.rateLimit.mockResolvedValue(undefined);
	mocks.build.mockResolvedValue({ formatVersion: 1, comments: [] });
	vi.useRealTimers();
});

describe('GET /api/me/export', () => {
	it('is 401 signed out, before any read', async () => {
		await expect(GET(event(null))).rejects.toMatchObject({ status: 401 });
		expect(mocks.build).not.toHaveBeenCalled();
		expect(mocks.rateLimit).not.toHaveBeenCalled();
	});

	it('answers a private JSON download named for the username and the day', async () => {
		vi.useFakeTimers({ now: new Date('2026-11-17T12:00:00Z'), toFake: ['Date'] });
		const response = await GET(event(user));
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(response.headers.get('content-type')).toContain('application/json');
		expect(response.headers.get('content-disposition')).toBe(
			'attachment; filename="midb-data-anna_1234-2026-11-17.json"'
		);
		expect(JSON.parse(await response.text())).toEqual({ formatVersion: 1, comments: [] });
		expect(mocks.build).toHaveBeenCalledWith(user, new Date('2026-11-17T12:00:00Z'));
	});

	it('limits the account by its id, and refuses with 429 past the limit', async () => {
		await GET(event(user));
		expect(mocks.rateLimit).toHaveBeenCalledWith(expect.anything(), 'RL_EXPORT', {
			userId: 'anna-id'
		});
		mocks.rateLimit.mockRejectedValue({ status: 429 });
		await expect(GET(event(user))).rejects.toMatchObject({ status: 429 });
		expect(mocks.build).toHaveBeenCalledTimes(1);
	});

	it('skips the limit for staff', async () => {
		await GET(event({ ...user, role: 'moderator' }));
		expect(mocks.rateLimit).not.toHaveBeenCalled();
	});

	it('keeps only safe characters of the username in the file name', async () => {
		const response = await GET(event({ ...user, username: 'a"b/c d' }));
		expect(response.headers.get('content-disposition')).toMatch(/filename="midb-data-abcd-/);
		const none = await GET(event({ ...user, username: null }));
		expect(none.headers.get('content-disposition')).toMatch(/filename="midb-data-account-/);
	});
});
