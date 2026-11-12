import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

vi.mock('$app/env/public', () => ({ PUBLIC_TMDB_IMAGE_URL: '/img/tmdb' }));

const { GET } = await import('../routes/img/tmdb/[size]/[file]/+server');

function call(size: string, file: string) {
	const event = { params: { size, file } } as unknown as RequestEvent;
	return GET(event as Parameters<typeof GET>[0]);
}

const imageResponse = (init?: ResponseInit) =>
	new Response('bytes', { headers: { 'content-type': 'image/jpeg' }, ...init });

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	fetchSpy = vi.spyOn(globalThis, 'fetch');
});
afterEach(() => vi.restoreAllMocks());

describe('GET /img/tmdb/[size]/[file]', () => {
	it('fetches the file from TMDB and serves it with the image cache policy', async () => {
		fetchSpy.mockResolvedValueOnce(imageResponse());
		const res = await call('w500', 'abc_D-1.jpg');
		expect(fetchSpy).toHaveBeenCalledWith('https://image.tmdb.org/t/p/w500/abc_D-1.jpg');
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('public, max-age=2592000');
		expect(res.headers.get('content-type')).toBe('image/jpeg');
		expect(res.headers.get('x-content-type-options')).toBe('nosniff');
		await expect(res.text()).resolves.toBe('bytes');
	});

	it.each(['w92', 'w200', 'w300', 'w400', 'w500', 'w780'])('allows %s', async (size) => {
		fetchSpy.mockResolvedValueOnce(imageResponse());
		expect((await call(size, 'a.png')).status).toBe(200);
	});

	it.each(['original', 'w1280', 'w93', 'W500', '', '500'])(
		'rejects the size %j without fetching',
		async (size) => {
			const res = await call(size, 'a.jpg');
			expect(res.status).toBe(400);
			expect(res.headers.get('cache-control')).toBe('private, no-store');
			expect(fetchSpy).not.toHaveBeenCalled();
		}
	);

	it.each(['', 'a.gif', '../a.jpg', 'a/b.jpg', 'a.jpg?x=1', 'a b.jpg', '.jpg', 'a.jpg.jpg'])(
		'rejects the file %j without fetching',
		async (file) => {
			const res = await call('w500', file);
			expect(res.status).toBe(400);
			expect(fetchSpy).not.toHaveBeenCalled();
		}
	);

	it('answers 404 for a file TMDB does not have, never cached', async () => {
		fetchSpy.mockResolvedValueOnce(new Response('nope', { status: 404 }));
		const res = await call('w500', 'missing.jpg');
		expect(res.status).toBe(404);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});

	it('answers 502 for an upstream error or a network failure, never cached', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		fetchSpy
			.mockResolvedValueOnce(new Response('boom', { status: 500 }))
			.mockRejectedValueOnce(new Error('down'));
		for (let i = 0; i < 2; i++) {
			const res = await call('w500', 'a.jpg');
			expect(res.status).toBe(502);
			expect(res.headers.get('cache-control')).toBe('private, no-store');
		}
	});

	it.each(['image/png', 'image/webp', 'image/jpeg; charset=binary'])('serves %s', async (type) => {
		fetchSpy.mockResolvedValueOnce(new Response('b', { headers: { 'content-type': type } }));
		const res = await call('w500', 'a.jpg');
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe(type.split(';')[0]);
	});

	it.each(['image/svg+xml', 'image/gif', 'text/html', ''])(
		'refuses the upstream type %j',
		async (type) => {
			fetchSpy.mockResolvedValueOnce(new Response('b', { headers: { 'content-type': type } }));
			const res = await call('w500', 'a.jpg');
			expect(res.status).toBe(502);
			expect(res.headers.get('cache-control')).toBe('private, no-store');
		}
	);

	it('refuses an upstream answer that is not an image', async () => {
		fetchSpy.mockResolvedValueOnce(
			new Response('<html>', { headers: { 'content-type': 'text/html' } })
		);
		const res = await call('w500', 'a.jpg');
		expect(res.status).toBe(502);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});
});
