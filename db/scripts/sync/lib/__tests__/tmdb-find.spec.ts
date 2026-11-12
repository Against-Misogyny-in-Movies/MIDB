import { describe, it, expect, vi } from 'vitest';
import { resolveTmdbId } from '../tmdb-find.ts';
import { USER_AGENT } from '../http.ts';

const options = { retryDelayMs: 0 };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('resolveTmdbId', () => {
	it('sends the token and the MIDB-sync User-Agent to /find', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => json({ movie_results: [{ id: 603 }] }));
		expect(await resolveTmdbId('tt0133093', 'secret', { ...options, fetchImpl })).toBe(603);
		const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
		expect(url).toContain('/3/find/tt0133093?external_source=imdb_id');
		expect(init.headers).toMatchObject({
			Authorization: 'Bearer secret',
			'User-Agent': USER_AGENT
		});
	});

	it('returns null only for an OK answer with no film', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => json({ movie_results: [], tv_results: [] }));
		expect(await resolveTmdbId('tt0000001', 'secret', { ...options, fetchImpl })).toBeNull();
	});

	it('throws on an auth failure instead of counting the film as not found', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => json({ status_code: 7 }, 401));
		await expect(resolveTmdbId('tt0133093', 'bad', { ...options, fetchImpl })).rejects.toThrow(
			/Could not read/
		);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it('retries a 5xx once, then throws', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => json({}, 503));
		await expect(resolveTmdbId('tt0133093', 'secret', { ...options, fetchImpl })).rejects.toThrow(
			/Could not read/
		);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('throws on a network error', async () => {
		const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error('reset'));
		await expect(resolveTmdbId('tt0133093', 'secret', { ...options, fetchImpl })).rejects.toThrow(
			/Could not read/
		);
	});

	it('throws on an OK answer that is not a /find result', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => json({ ok: true }));
		await expect(resolveTmdbId('tt0133093', 'secret', { ...options, fetchImpl })).rejects.toThrow(
			/no movie_results/
		);
	});
});
