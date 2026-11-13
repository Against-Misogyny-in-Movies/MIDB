import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import { resetCloudflareStub } from '#test/cloudflare-workers.stub.ts';

const getCommentThread = vi.fn();

vi.mock('#lib/server/data/comment-queries.ts', () => ({
	getCommentThread,
	editComment: vi.fn(),
	softDeleteComment: vi.fn()
}));

const route = await import('../routes/api/comments/[id]/+server');
const { clearCache } = await import('#lib/server/cache/index.ts');

const THREAD = { root: { id: 'c1', body: 'Text', replies: [] }, review: null };

const user = (overrides: Partial<UserRow> = {}) =>
	({ id: 'u1', role: 'user', bannedAt: null, mutedUntil: null, ...overrides }) as UserRow;

async function get(
	id: string,
	signedIn: UserRow | null = null,
	getUser = async () => signedIn
): Promise<Response> {
	return route.GET({
		params: { id },
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
	getCommentThread.mockResolvedValue(THREAD);
});

describe('GET /api/comments/[id]', () => {
	it('answers the thread, never stored by a browser or the edge', async () => {
		const res = await get('c1');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(THREAD);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(res.headers.get('cdn-cache-control')).toBeNull();
		expect(res.headers.get('cache-tag')).toBeNull();
	});

	it('reads the signed-in reader and passes only their id and role', async () => {
		await get('c1', user({ id: 'mod', role: 'moderator' }));
		expect(getCommentThread).toHaveBeenCalledWith('c1', expect.objectContaining({ id: 'mod' }));
		await get('c1');
		expect(getCommentThread).toHaveBeenLastCalledWith('c1', null);
	});

	it('answers 404 for a comment the reader may not see, or one that does not exist', async () => {
		getCommentThread.mockResolvedValue(null);
		expect(await status(get('c1'))).toBe(404);
	});

	it('answers 404 for an id that cannot be a comment, without a lookup', async () => {
		expect(await status(get('a/../b'))).toBe(404);
		expect(await status(get('x'.repeat(65)))).toBe(404);
		expect(getCommentThread).not.toHaveBeenCalled();
	});

	it('answers 429 past the read limit per address, for signed-in readers too', async () => {
		for (let i = 0; i < 60; i++) expect(await status(get('c1', user()))).toBe(200);
		expect(await status(get('c1', user()))).toBe(429);
		expect(await status(get('c1'))).toBe(429);
		expect(getCommentThread).toHaveBeenCalledTimes(60);
	});

	it('does not read the user once the limit refused the request', async () => {
		for (let i = 0; i < 60; i++) await get('c1');
		const getUser = vi.fn(async () => null);
		expect(await status(get('c1', null, getUser))).toBe(429);
		expect(getUser).not.toHaveBeenCalled();
	});
});
