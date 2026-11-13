import { describe, it, expect, beforeEach } from 'vitest';
import {
	purgeCalls,
	resetCloudflareStub,
	waitUntilPromises
} from '#test/cloudflare-workers.stub.ts';
import { purgeTitleComments } from '../purge-title.ts';

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
