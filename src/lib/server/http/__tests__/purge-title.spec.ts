import { describe, it, expect, beforeEach } from 'vitest';
import {
	purgeCalls,
	resetCloudflareStub,
	waitUntilPromises
} from '#test/cloudflare-workers.stub.ts';
import {
	PURGE_TAGS_PER_REQUEST,
	purgeProfile,
	purgeProfiles,
	purgeTitleComments,
	purgeTitleReports,
	purgeTitlesReports
} from '../purge-title.ts';

beforeEach(resetCloudflareStub);

describe('purgeTitleComments', () => {
	it('purges the title’s comment tag after the response', async () => {
		purgeTitleComments({ kind: 'movie', tmdbId: 348 });
		await Promise.all(waitUntilPromises);
		expect(purgeCalls).toEqual([{ tags: ['comments:movie:348'] }]);
	});

	it('purges nothing for a title with no TMDB id', async () => {
		purgeTitleComments({ kind: 'movie', tmdbId: null });
		await Promise.all(waitUntilPromises);
		expect(purgeCalls).toEqual([]);
	});
});

describe('purgeTitlesReports', () => {
	it('sends the tags in requests of at most the chunk size, skipping titles with no TMDB id', async () => {
		const titles = Array.from({ length: PURGE_TAGS_PER_REQUEST + 5 }, (_, i) => ({
			kind: 'movie',
			tmdbId: i + 1
		}));
		purgeTitlesReports([...titles, { kind: 'tv', tmdbId: null }]);
		await Promise.all(waitUntilPromises);
		expect(purgeCalls.map((c) => c.tags?.length)).toEqual([PURGE_TAGS_PER_REQUEST, 5]);
		expect(purgeCalls[0].tags?.[0]).toBe('reports:movie:1');
	});

	it('purges nothing for no titles, and one title as one tag like purgeTitleReports', async () => {
		purgeTitlesReports([]);
		purgeTitleReports({ kind: 'tv', tmdbId: 7 });
		await Promise.all(waitUntilPromises);
		expect(purgeCalls).toEqual([{ tags: ['reports:tv:7'] }]);
	});
});

describe('purgeProfile', () => {
	it('purges the account’s profile tag after the response', async () => {
		purgeProfile('anna-id');
		await Promise.all(waitUntilPromises);
		expect(purgeCalls).toEqual([{ tags: ['profile:anna-id'] }]);
	});

	it('purges several accounts once each, in requests of at most the chunk size', async () => {
		const ids = Array.from({ length: PURGE_TAGS_PER_REQUEST + 2 }, (_, i) => `u${i}`);
		purgeProfiles([...ids, 'u0']);
		purgeProfiles([]);
		await Promise.all(waitUntilPromises);
		expect(purgeCalls.map((c) => c.tags?.length)).toEqual([PURGE_TAGS_PER_REQUEST, 2]);
		expect(purgeCalls[0].tags?.[0]).toBe('profile:u0');
	});
});
