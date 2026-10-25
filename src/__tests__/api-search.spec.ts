import { describe, it, expect, vi, beforeEach } from 'vitest';
import { error, type RequestEvent } from '@sveltejs/kit';
import { SEARCH_QUERY_MAX_LENGTH } from '$lib/media/utils/search';

const searchTitles = vi.fn();
vi.mock('$lib/server/integrations/tmdb', () => ({ searchTitles }));

const { GET } = await import('../routes/api/search/+server');

const HIT = {
	id: 603,
	title: 'The Matrix',
	posterPath: null,
	releaseYear: '1999',
	mediaType: 'movie'
};

function call(q: string | null) {
	const url = new URL('http://localhost/api/search');
	if (q !== null) url.searchParams.set('q', q);
	const event = { url } as unknown as RequestEvent;
	return GET(event as Parameters<typeof GET>[0]);
}

beforeEach(() => {
	searchTitles.mockReset();
	searchTitles.mockResolvedValue([HIT]);
});

describe('GET /api/search', () => {
	it('returns the results with the public search cache-control', async () => {
		const res = await call('  matrix ');
		expect(res.headers.get('cache-control')).toBe('public, max-age=60, s-maxage=600');
		await expect(res.json()).resolves.toEqual({ results: [HIT] });
		expect(searchTitles).toHaveBeenCalledWith('matrix');
	});

	it('short-circuits an empty or blank query without calling TMDB', async () => {
		for (const q of [null, '', '   ']) {
			const res = await call(q);
			await expect(res.json()).resolves.toEqual({ results: [] });
		}
		expect(searchTitles).not.toHaveBeenCalled();
	});

	it(`truncates the query to ${SEARCH_QUERY_MAX_LENGTH} characters`, async () => {
		const long = 'a'.repeat(SEARCH_QUERY_MAX_LENGTH) + 'bbbbb';
		await call(long);
		expect(searchTitles).toHaveBeenCalledWith('a'.repeat(SEARCH_QUERY_MAX_LENGTH));

		// Trimmed first, so leading spaces do not eat into the cap.
		await call('   ' + long);
		expect(searchTitles).toHaveBeenLastCalledWith('a'.repeat(SEARCH_QUERY_MAX_LENGTH));
	});

	it('answers a TMDB error with an uncached empty list', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		searchTitles.mockImplementation(async () => {
			throw error(503, 'TMDB error: Service Unavailable');
		});
		const res = await call('matrix');
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBeNull();
		await expect(res.json()).resolves.toEqual({ results: [] });

		searchTitles.mockRejectedValue(new TypeError('fetch failed'));
		const res2 = await call('matrix');
		expect(res2.headers.get('cache-control')).toBeNull();
		await expect(res2.json()).resolves.toEqual({ results: [] });
		expect(warn).toHaveBeenCalledTimes(2);
		warn.mockRestore();
	});
});
