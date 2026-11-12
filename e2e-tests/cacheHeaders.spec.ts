import { expect, test } from '@playwright/test';
import { seedTitle } from './support/db.ts';
import { hasTmdb, NO_TMDB_REASON } from './support/env.ts';

// The response headers are the contract with Workers Caching (`docs/architecture.md`, Caching
// policy). Workers Caching is not emulated locally, so these check what the Worker sends; a hit
// is checked on a deployed Worker. The values are written out on purpose: a change to a policy
// must change its spec.
const PRIVATE = 'private, no-store';

test.describe('public responses', () => {
	test('/resources: the page and its __data.json carry the page policy', async ({ request }) => {
		for (const path of ['/resources', '/resources/__data.json']) {
			const response = await request.get(path);
			expect(response.status(), path).toBe(200);
			expect(response.headers()['cache-control'], path).toBe('public, max-age=0');
			expect(response.headers()['cdn-cache-control'], path).toBe(
				'max-age=3600, stale-while-revalidate=86400'
			);
		}
	});

	test('the landing page is kept by no cache', async ({ request }) => {
		const response = await request.get('/');
		expect(response.headers()['cache-control']).toBe('no-store');
		expect(response.headers()['cdn-cache-control']).toBeUndefined();
	});

	test('a comment list carries the comment policy and its title tag', async ({ request }) => {
		seedTitle('movie', 910001, 'Cache header fixture');
		for (const tmdbId of ['910001', '910002']) {
			// 910002 has no row: the list is empty, and still tagged, so a first comment purges it.
			const response = await request.get(`/api/titles/movie/${tmdbId}/comments`);
			expect(response.status()).toBe(200);
			expect(response.headers()['cache-control']).toBe('public, max-age=0');
			expect(response.headers()['cdn-cache-control']).toBe(
				'max-age=600, stale-while-revalidate=60'
			);
			expect(response.headers()['cache-tag']).toBe(`comments:movie:${tmdbId}`);
			expect(response.headers()['set-cookie']).toBeUndefined();
			expect(await response.json()).toEqual({ comments: [], nextCursor: null });
		}
	});

	test('an image request that fails validation is never cached', async ({ request }) => {
		const response = await request.get('/img/tmdb/w500/not-an-image');
		expect(response.status()).toBe(400);
		expect(response.headers()['cache-control']).toBe(PRIVATE);
	});
});

test.describe('private responses', () => {
	test('/api/me and /api/auth/* are private, no-store', async ({ request }) => {
		for (const path of ['/api/me', '/api/auth/ok']) {
			const response = await request.get(path);
			expect(response.status(), path).toBe(200);
			expect(response.headers()['cache-control'], path).toBe(PRIVATE);
			expect(response.headers()['cdn-cache-control'], path).toBeUndefined();
		}
	});

	test('the comment viewer endpoint is private, no-store', async ({ request }) => {
		const response = await request.get('/api/titles/movie/910001/comments/viewer');
		// Signed out: 401, and still never stored.
		expect(response.status()).toBe(401);
		expect(response.headers()['cache-control']).toBe(PRIVATE);
	});

	test('/user/* answers a signed-out request with a private redirect', async ({ request }) => {
		const response = await request.get('/user/profile', { maxRedirects: 0 });
		expect(response.status()).toBe(303);
		expect(response.headers()['location']).toBe('/auth');
		expect(response.headers()['cache-control']).toBe(PRIVATE);
	});
});

test.describe('title pages', () => {
	test.skip(!hasTmdb, NO_TMDB_REASON);

	test('a film page and its __data.json carry the page policy', async ({ request }) => {
		for (const path of ['/movie/603', '/movie/603/__data.json']) {
			const response = await request.get(path);
			expect(response.status(), path).toBe(200);
			expect(response.headers()['cache-control'], path).toBe('public, max-age=0');
			expect(response.headers()['cdn-cache-control'], path).toBe(
				'max-age=3600, stale-while-revalidate=86400'
			);
			expect(response.headers()['set-cookie'], path).toBeUndefined();
		}
	});

	test('a series page carries the page policy', async ({ request }) => {
		const response = await request.get('/tv/1396');
		expect(response.status()).toBe(200);
		expect(response.headers()['cache-control']).toBe('public, max-age=0');
		expect(response.headers()['cdn-cache-control']).toBe(
			'max-age=3600, stale-while-revalidate=86400'
		);
	});
});
