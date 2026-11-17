import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { resetCloudflareStub } from '#test/cloudflare-workers.stub.ts';

const findProfileOwner = vi.fn();
const getProfileReports = vi.fn();
vi.mock('#lib/server/data/profile-queries.ts', () => ({
	findProfileOwner: (...args: unknown[]) => findProfileOwner(...args),
	getProfileReports: (...args: unknown[]) => getProfileReports(...args)
}));

const route = await import('../+server');
const { clearCache } = await import('#lib/server/cache/index.ts');

const PAGE = { reports: [{ kind: 'movie', tmdbId: 348, name: 'Alien' }], nextCursor: '123.t1' };
const getUser = vi.fn(async () => null);

async function get(username: string, query = ''): Promise<Response> {
	return await route.GET({
		params: { username },
		url: new URL(`http://localhost/api/users/${username}/reports${query}`),
		locals: { getUser },
		getClientAddress: () => '203.0.113.9'
	} as never);
}

async function status(promise: Promise<Response>): Promise<number> {
	try {
		return (await promise).status;
	} catch (err) {
		if (isHttpError(err)) return err.status;
		throw err;
	}
}

beforeEach(async () => {
	resetCloudflareStub();
	await clearCache();
	vi.clearAllMocks();
	findProfileOwner.mockResolvedValue({ id: 'anna-id' });
	getProfileReports.mockResolvedValue(PAGE);
});

describe('GET /api/users/[username]/reports', () => {
	it('answers a page of reports with the public policy and the account’s cache tag', async () => {
		const res = await get('anna', '?cursor=99.t0');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(PAGE);
		expect(getProfileReports).toHaveBeenCalledWith('anna-id', '99.t0');
		expect(res.headers.get('cache-control')).toBe('public, max-age=0');
		expect(res.headers.get('cdn-cache-control')).toContain('max-age=3600');
		expect(res.headers.get('cache-tag')).toBe('profile:anna-id');
		expect(res.headers.get('set-cookie')).toBeNull();
		expect(getUser).not.toHaveBeenCalled();
	});

	it('starts at the first page without a cursor', async () => {
		await get('anna');
		expect(getProfileReports).toHaveBeenCalledWith('anna-id', null);
	});

	it('answers 404 for an unknown or banned account, with no cache policy', async () => {
		findProfileOwner.mockResolvedValue(null);
		expect(await status(get('nobody'))).toBe(404);
		expect(getProfileReports).not.toHaveBeenCalled();
	});

	it('answers 400 for a cursor that is too long or not one the list made', async () => {
		expect(await status(get('anna', `?cursor=${'1'.repeat(101)}`))).toBe(400);
		expect(await status(get('anna', '?cursor=abc'))).toBe(400);
		expect(await status(get('anna', '?cursor=12.a%20b'))).toBe(400);
		expect(getProfileReports).not.toHaveBeenCalled();
	});

	it('is limited by address, 60 reads a minute', async () => {
		for (let i = 0; i < 60; i++) expect(await status(get('anna'))).toBe(200);
		expect(await status(get('anna'))).toBe(429);
		expect(findProfileOwner).toHaveBeenCalledTimes(60);
	});
});
