import { beforeEach, describe, expect, it, vi } from 'vitest';
import { error, isHttpError } from '@sveltejs/kit';
import { resetCloudflareStub } from '#test/cloudflare-workers.stub.ts';

const getMovie = vi.fn();
const getSeries = vi.fn();
const getTriggerTagsLive = vi.fn();
const getTriggerTagsForSeries = vi.fn();
const getLetterboxdRating = vi.fn();

vi.mock('#lib/server/integrations/tmdb/index.ts', () => ({ getMovie, getSeries }));
vi.mock('#lib/server/integrations/ddd.ts', () => ({ getTriggerTagsLive, getTriggerTagsForSeries }));
vi.mock('#lib/server/integrations/letterboxd.ts', () => ({ getLetterboxdRating }));

const route = await import('../routes/api/titles/[kind]/[tmdbId]/sources/+server');
const { clearCache } = await import('#lib/server/cache/index.ts');

const TAGS = { itemId: 7, tags: [{ topicItemId: 1 }], isSeries: false };
const RATING = { rating: 4.2, ratingCount: 120, url: 'https://letterboxd.com/film/alien/' };

function get(kind: string, tmdbId: string, getUser = vi.fn(), ip = '203.0.113.9') {
	return route.GET({
		params: { kind, tmdbId },
		locals: { getUser },
		getClientAddress: () => ip
	} as never);
}

async function status(promise: Promise<Response> | Response): Promise<number> {
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
	vi.resetAllMocks();
	getMovie.mockResolvedValue({ tmdbId: '348', imdbId: 'tt0078748' });
	getSeries.mockResolvedValue({ tmdbId: '70523', title: 'Dark', firstAirDate: '2017-12-01' });
	getTriggerTagsLive.mockResolvedValue({ result: TAGS, failed: false });
	getTriggerTagsForSeries.mockResolvedValue({
		result: { ...TAGS, isSeries: true },
		failed: false
	});
	getLetterboxdRating.mockResolvedValue(RATING);
});

describe('GET /api/titles/[kind]/[tmdbId]/sources', () => {
	it('answers a film with both sources, looked up by the IMDb id TMDB gives', async () => {
		const res = await get('movie', '348');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ddd: TAGS, letterboxd: RATING });
		expect(getMovie).toHaveBeenCalledWith('348');
		expect(getTriggerTagsLive).toHaveBeenCalledWith('tt0078748');
		expect(getLetterboxdRating).toHaveBeenCalledWith('348');
	});

	it('answers a series by its TMDB record, with no Letterboxd lookup', async () => {
		const res = await get('tv', '70523');
		expect(await res.json()).toEqual({ ddd: { ...TAGS, isSeries: true }, letterboxd: null });
		expect(getTriggerTagsForSeries).toHaveBeenCalledWith(
			expect.objectContaining({ title: 'Dark' })
		);
		expect(getLetterboxdRating).not.toHaveBeenCalled();
	});

	it('is shared for an hour at the edge when every source answered, with no cookie and no user', async () => {
		const getUser = vi.fn();
		const res = await get('movie', '348', getUser);
		expect(res.headers.get('cache-control')).toBe('public, max-age=0');
		expect(res.headers.get('cdn-cache-control')).toBe('max-age=3600, stale-while-revalidate=60');
		expect(res.headers.get('set-cookie')).toBeNull();
		expect(getUser).not.toHaveBeenCalled();
	});

	it('a film Letterboxd has no rating for is still complete', async () => {
		getLetterboxdRating.mockResolvedValue(null);
		const res = await get('movie', '348');
		expect(await res.json()).toMatchObject({ letterboxd: null });
		expect(res.headers.get('cache-control')).toBe('public, max-age=0');
	});

	it('keeps no public policy when Does the Dog Die failed', async () => {
		getTriggerTagsLive.mockResolvedValue({
			result: { itemId: null, tags: [], isSeries: false },
			failed: true
		});
		const res = await get('movie', '348');
		expect(await res.json()).toEqual({
			ddd: { itemId: null, tags: [], isSeries: false },
			letterboxd: RATING
		});
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(res.headers.get('cdn-cache-control')).toBeNull();
	});

	it('keeps no public policy when Letterboxd failed', async () => {
		getLetterboxdRating.mockResolvedValue('failed');
		const res = await get('movie', '348');
		expect(await res.json()).toMatchObject({ ddd: TAGS, letterboxd: 'failed' });
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});

	it('treats a thrown lookup as failed, empty for DDD and failed for Letterboxd', async () => {
		getTriggerTagsLive.mockRejectedValue(new Error('network'));
		getLetterboxdRating.mockRejectedValue(new Error('network'));
		const res = await get('movie', '348');
		expect(await res.json()).toEqual({
			ddd: { itemId: null, tags: [], isSeries: false },
			letterboxd: 'failed'
		});
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});

	it('a TMDB error other than 404 fails DDD only, so a series is empty with isSeries', async () => {
		getSeries.mockRejectedValue(new Error('TMDB down'));
		const res = await get('tv', '70523');
		expect(await res.json()).toEqual({
			ddd: { itemId: null, tags: [], isSeries: true },
			letterboxd: null
		});
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});

	it('answers 404 when TMDB does not know the id', async () => {
		getMovie.mockImplementation(() => error(404, 'TMDB error: Not Found'));
		expect(await status(get('movie', '348'))).toBe(404);
	});

	it.each([
		['movie', 'abc'],
		['movie', '..%2F3'],
		['movie', '1234567890'],
		['person', '348']
	])('answers 404 for %s/%s before any request goes out', async (kind, id) => {
		expect(await status(get(kind, id))).toBe(404);
		expect(getMovie).not.toHaveBeenCalled();
		expect(getTriggerTagsLive).not.toHaveBeenCalled();
		expect(getLetterboxdRating).not.toHaveBeenCalled();
	});

	it('answers 429 past 60 requests a minute from one address, never reading the user', async () => {
		const getUser = vi.fn();
		for (let i = 0; i < 60; i++) expect(await status(get('movie', '348', getUser))).toBe(200);
		expect(await status(get('movie', '348', getUser))).toBe(429);
		expect(await status(get('movie', '348', getUser, '198.51.100.4'))).toBe(200);
		expect(getUser).not.toHaveBeenCalled();
	});
});
