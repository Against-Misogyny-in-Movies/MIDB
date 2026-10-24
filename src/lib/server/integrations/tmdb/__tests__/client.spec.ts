import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearCache } from '$lib/server/cache';
import movieFixture from '$lib/server/integrations/tmdb/__tests__/fixtures/movie-603.json';
import searchFixture from '$lib/server/integrations/tmdb/__tests__/fixtures/search-matrix.json';

vi.mock('$env/static/public', () => ({ PUBLIC_TMDB_API_URL: 'https://tmdb.test' }));
vi.mock('$env/static/private', () => ({ TMDB_API_TOKEN: 'test-token' }));

import { tmdbFetch } from '$lib/server/integrations/tmdb/client';
import { getMovie, searchTitles } from '$lib/server/integrations/tmdb';

const fetchMock = vi.fn();

function respond(body: unknown, status = 200, statusText = 'OK') {
	fetchMock.mockResolvedValueOnce(
		new Response(JSON.stringify(body), { status, statusText, headers: { 'content-type': 'json' } })
	);
}

beforeEach(async () => {
	await clearCache();
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('tmdbFetch', () => {
	test('sends the bearer token and the params as the query string', async () => {
		respond({ ok: true });
		await tmdbFetch('/3/movie/603', { append_to_response: 'credits,external_ids' });
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://tmdb.test/3/movie/603?append_to_response=credits%2Cexternal_ids');
		expect(init.headers).toEqual({
			Authorization: 'Bearer test-token',
			accept: 'application/json'
		});
	});

	test('maps a non-OK response to a SvelteKit HttpError with the same status', async () => {
		respond({}, 404, 'Not Found');
		await expect(tmdbFetch('/3/movie/0')).rejects.toMatchObject({
			status: 404,
			body: { message: 'TMDB error: Not Found' }
		});
	});
});

describe('getMovie', () => {
	test('maps the response and caches it per id', async () => {
		respond(movieFixture);
		const first = await getMovie('603');
		const second = await getMovie('603');
		expect(first.title).toBe('The Matrix');
		expect(second).toEqual(first);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe(
			'https://tmdb.test/3/movie/603?append_to_response=credits%2Cexternal_ids&language=en-US'
		);
	});
});

describe('searchTitles', () => {
	test('returns mapped movie/tv hits', async () => {
		respond(searchFixture);
		const results = await searchTitles('matrix');
		expect(results.map((r) => r.id)).toEqual([603, 604, 87299, 624860]);
		expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('query')).toBe('matrix');
	});

	test('returns [] on a TMDB error response', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		respond({}, 503, 'Service Unavailable');
		expect(await searchTitles('matrix')).toEqual([]);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});
});
