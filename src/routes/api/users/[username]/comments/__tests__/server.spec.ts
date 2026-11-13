import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { resetCloudflareStub } from '#test/cloudflare-workers.stub.ts';

const findProfileOwner = vi.fn();
const getProfileComments = vi.fn();
vi.mock('#lib/server/data/profile-queries.ts', () => ({
	findProfileOwner: (...args: unknown[]) => findProfileOwner(...args),
	getProfileComments: (...args: unknown[]) => getProfileComments(...args)
}));

const route = await import('../+server');
const { clearCache } = await import('#lib/server/cache/index.ts');

const PAGE = { comments: [{ id: 'c1' }], nextCursor: '123.c1' };

async function get(username: string, query = ''): Promise<Response> {
	const getUser = vi.fn(async () => null);
	return await route.GET({
		params: { username },
		url: new URL(`http://localhost/api/users/${username}/comments${query}`),
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
	getProfileComments.mockResolvedValue(PAGE);
});

describe('GET /api/users/[username]/comments', () => {
	it('answers a page with the public policy and the account’s cache tag', async () => {
		const res = await get('anna', '?cursor=99.c0');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(PAGE);
		expect(getProfileComments).toHaveBeenCalledWith('anna-id', '99.c0');
		expect(res.headers.get('cache-control')).toBe('public, max-age=0');
		expect(res.headers.get('cdn-cache-control')).toContain('max-age=3600');
		expect(res.headers.get('cache-tag')).toBe('profile:anna-id');
	});

	it('starts at the first page without a cursor', async () => {
		await get('anna');
		expect(getProfileComments).toHaveBeenCalledWith('anna-id', null);
	});

	it('answers 404 for an unknown or banned account, with no cache policy', async () => {
		findProfileOwner.mockResolvedValue(null);
		expect(await status(get('nobody'))).toBe(404);
		expect(getProfileComments).not.toHaveBeenCalled();
	});

	it('answers 400 for a cursor that is too long', async () => {
		expect(await status(get('anna', `?cursor=${'x'.repeat(101)}`))).toBe(400);
	});

	it('is limited by address, 60 reads a minute', async () => {
		for (let i = 0; i < 60; i++) expect(await status(get('anna'))).toBe(200);
		expect(await status(get('anna'))).toBe(429);
		expect(findProfileOwner).toHaveBeenCalledTimes(60);
	});
});
