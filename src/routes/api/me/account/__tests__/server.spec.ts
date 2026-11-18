import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE_SESSION_MAX_AGE_MINUTES } from '#lib/media/utils/accountDeletion.ts';

const mocks = vi.hoisted(() => ({
	scrub: vi.fn(),
	session: vi.fn(),
	rateLimit: vi.fn(),
	signOut: vi.fn(),
	purgeProfiles: vi.fn(),
	purgeComments: vi.fn(),
	purgeReports: vi.fn()
}));

vi.mock('#lib/server/data/account-scrub.ts', () => ({ scrubAccount: mocks.scrub }));
vi.mock('#lib/server/auth/current-session.ts', () => ({ currentSession: mocks.session }));
vi.mock('#lib/server/auth/auth.ts', () => ({
	getAuth: () => ({ api: { signOut: mocks.signOut } })
}));
vi.mock('#lib/server/http/rate-limit.ts', () => ({ rateLimit: mocks.rateLimit }));
vi.mock('#lib/server/http/purge-title.ts', () => ({
	purgeProfiles: mocks.purgeProfiles,
	purgeTitlesComments: mocks.purgeComments,
	purgeTitlesReports: mocks.purgeReports
}));

const { DELETE } = await import('../+server.ts');

const NOW = new Date('2026-11-17T12:00:00Z');
const anna = { id: 'anna-id', role: 'user', username: 'Anna_1234', mutedUntil: null };

const event = (user: unknown, body: unknown = { username: 'anna_1234' }) =>
	({
		locals: { getUser: async () => user },
		request: new Request('http://localhost/api/me/account', {
			method: 'DELETE',
			body: typeof body === 'string' ? body : JSON.stringify(body)
		})
	}) as never;

const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

beforeEach(() => {
	vi.resetAllMocks();
	vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
	mocks.rateLimit.mockResolvedValue(undefined);
	mocks.session.mockResolvedValue({ id: 's-1', startedAt: minutesAgo(1) });
	mocks.scrub.mockResolvedValue({
		ok: true,
		commentTitles: [{ kind: 'movie', tmdbId: 348 }],
		reportTitles: [{ kind: 'tv', tmdbId: 95396 }],
		replyAuthorIds: ['bob-id']
	});
	mocks.signOut.mockResolvedValue({
		headers: new Headers([
			['set-cookie', 'better-auth.session_token=; Max-Age=0; Path=/'],
			['set-cookie', 'better-auth.session_data=; Max-Age=0; Path=/']
		])
	});
});

describe('DELETE /api/me/account', () => {
	it('deletes the account, purges, and clears the session cookies, privately', async () => {
		const response = await DELETE(event(anna));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(response.headers.getSetCookie()).toEqual([
			'better-auth.session_token=; Max-Age=0; Path=/',
			'better-auth.session_data=; Max-Age=0; Path=/'
		]);
		expect(mocks.scrub).toHaveBeenCalledWith('anna-id');
		expect(mocks.purgeProfiles).toHaveBeenCalledWith(['anna-id', 'bob-id']);
		expect(mocks.purgeComments).toHaveBeenCalledWith([{ kind: 'movie', tmdbId: 348 }]);
		expect(mocks.purgeReports).toHaveBeenCalledWith([{ kind: 'tv', tmdbId: 95396 }]);
	});

	it('is 401 signed out, before anything else', async () => {
		await expect(DELETE(event(null))).rejects.toMatchObject({ status: 401 });
		expect(mocks.rateLimit).not.toHaveBeenCalled();
		expect(mocks.scrub).not.toHaveBeenCalled();
	});

	it('rate-limits per user, staff included, and a 429 stops the request', async () => {
		await DELETE(event({ ...anna, role: 'administrator' }));
		expect(mocks.rateLimit).toHaveBeenCalledWith(expect.anything(), 'RL_DELETE_ACCOUNT', {
			userId: 'anna-id'
		});
		mocks.rateLimit.mockRejectedValue(Object.assign(new Error('x'), { status: 429 }));
		await expect(DELETE(event(anna))).rejects.toMatchObject({ status: 429 });
		expect(mocks.scrub).toHaveBeenCalledTimes(1);
	});

	it('is 400 for a body that is not { username }', async () => {
		await expect(DELETE(event(anna, 'not json'))).rejects.toMatchObject({ status: 400 });
		await expect(DELETE(event(anna, {}))).rejects.toMatchObject({ status: 400 });
		await expect(DELETE(event(anna, { username: 7 }))).rejects.toMatchObject({ status: 400 });
		expect(mocks.scrub).not.toHaveBeenCalled();
	});

	it('is 401 when the asking session has ended, whatever the cached cookie says', async () => {
		mocks.session.mockResolvedValue(null);
		await expect(DELETE(event(anna))).rejects.toMatchObject({ status: 401 });
		expect(mocks.scrub).not.toHaveBeenCalled();
	});

	it('refuses a session that started before the window with session-stale', async () => {
		mocks.session.mockResolvedValue({
			id: 's-1',
			startedAt: minutesAgo(DELETE_SESSION_MAX_AGE_MINUTES + 1)
		});
		const response = await DELETE(event(anna));
		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: 'session-stale' });
		expect(mocks.scrub).not.toHaveBeenCalled();
	});

	it('accepts a session exactly at the window', async () => {
		mocks.session.mockResolvedValue({
			id: 's-1',
			startedAt: minutesAgo(DELETE_SESSION_MAX_AGE_MINUTES)
		});
		expect((await DELETE(event(anna))).status).toBe(200);
	});

	it('refuses a username that is not the account’s own with username-mismatch', async () => {
		const response = await DELETE(event(anna, { username: 'someone_else' }));
		expect(response.status).toBe(422);
		expect(await response.json()).toEqual({ error: 'username-mismatch' });
		expect((await DELETE(event(anna, { username: '' }))).status).toBe(422);
		expect(mocks.scrub).not.toHaveBeenCalled();
	});

	it('refuses an account with no username, even with nothing typed', async () => {
		const nameless = { ...anna, username: null };
		expect((await DELETE(event(nameless, { username: '' }))).status).toBe(422);
		expect((await DELETE(event(nameless, { username: '  ' }))).status).toBe(422);
		expect(mocks.scrub).not.toHaveBeenCalled();
	});

	it('compares the username without case or surrounding space', async () => {
		expect((await DELETE(event(anna, { username: '  ANNA_1234 ' }))).status).toBe(200);
	});

	it('answers last-administrator, 409, and clears nothing', async () => {
		mocks.scrub.mockResolvedValue({ ok: false, reason: 'last-administrator' });
		const response = await DELETE(event({ ...anna, role: 'administrator' }));
		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ error: 'last-administrator' });
		expect(response.headers.getSetCookie()).toEqual([]);
		expect(mocks.signOut).not.toHaveBeenCalled();
		expect(mocks.purgeProfiles).not.toHaveBeenCalled();
	});

	it('lets a muted account delete itself', async () => {
		const muted = { ...anna, mutedUntil: new Date(NOW.getTime() + 86_400_000) };
		expect((await DELETE(event(muted))).status).toBe(200);
	});

	it('still answers ok when the sign-out call fails, the account being gone', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		mocks.signOut.mockRejectedValue(new Error('boom'));
		const response = await DELETE(event(anna));
		expect(response.status).toBe(200);
		expect(response.headers.getSetCookie()).toEqual([]);
	});
});
