import { expect, test } from '@playwright/test';
import { hasTmdb, NO_TMDB_REASON } from './support/env.ts';

// Film and series pages, search and posters read TMDB through the Worker, so they need its token.
test.describe('with TMDB', () => {
	test.skip(!hasTmdb, NO_TMDB_REASON);

	test('search finds a film and opens its page', async ({ page }) => {
		await page.goto('/');
		const search = page.getByPlaceholder('Search films and series');
		await search.fill('The Matrix');
		const option = page
			.getByRole('listbox', { name: 'Search results' })
			.getByRole('option')
			.first();
		await expect(option).toContainText('The Matrix');
		await option.click();
		await page.waitForURL(/\/movie\/\d+$/);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	});

	test('a film page shows its title, sources and comments', async ({ page }) => {
		await page.goto('/movie/603');
		await expect(page.getByRole('heading', { level: 1 })).toContainText('The Matrix');
		await expect(page.getByRole('heading', { name: 'Comments' })).toBeVisible();
		await expect(page.getByText('No comments yet.')).toBeVisible();
	});

	test('a series page shows its title and comments', async ({ page }) => {
		await page.goto('/tv/1396');
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Breaking Bad');
		await expect(page.getByRole('heading', { name: 'Comments' })).toBeVisible();
	});

	test('the poster is requested from MIDB, not from TMDB', async ({ page }) => {
		const requests: string[] = [];
		page.on('request', (request) => requests.push(request.url()));
		await page.goto('/movie/603');
		await expect(page.locator('img[src*="/img/tmdb/w"]').first()).toBeAttached();
		expect(requests.filter((url) => url.includes('image.tmdb.org'))).toEqual([]);
	});
});

// The image route fetches from image.tmdb.org, which a restricted network may not reach.
test.describe('poster route', () => {
	let imageHostReachable = false;
	test.beforeAll(async () => {
		try {
			const probe = await fetch('https://image.tmdb.org/t/p/w92/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg', {
				signal: AbortSignal.timeout(5000)
			});
			imageHostReachable = probe.ok;
		} catch {
			imageHostReachable = false;
		}
	});

	test('a poster loads from /img/tmdb with the image policy', async ({ request }) => {
		test.skip(!imageHostReachable, 'image.tmdb.org is not reachable from this machine');
		const response = await request.get('/img/tmdb/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg');
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toBe('image/jpeg');
		expect(response.headers()['cache-control']).toBe('public, max-age=2592000');
		expect(response.headers()['set-cookie']).toBeUndefined();
		expect((await response.body()).byteLength).toBeGreaterThan(1000);
	});
});
