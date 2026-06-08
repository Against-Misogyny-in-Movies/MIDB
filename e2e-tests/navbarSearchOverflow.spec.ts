import { expect, test } from '@playwright/test';

// Regression: on mobile the navbar search dropdown was anchored to `.root`'s
// right edge (which sits mid-bar, left of the theme toggle + hamburger), so a
// 22rem panel overhung the viewport's left edge. The panel must stay within the
// viewport at phone widths.
test('navbar search results stay within the viewport on mobile', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 740 });

	// A long title exercises the widest the panel can get.
	await page.route('**/api/search?*', (route) =>
		route.fulfill({
			json: {
				results: [
					{
						id: 1,
						title: 'The Lord of the Rings: The Fellowship of the Ring',
						posterPath: null,
						releaseYear: '2001',
						mediaType: 'movie'
					}
				]
			}
		})
	);

	// /resources renders the navbar search (pathname !== '/') and needs no API/DB.
	await page.goto('/resources');

	await page.getByRole('button', { name: 'Search' }).click();
	const input = page.getByPlaceholder('Search movies & TV…');
	await input.fill('lord');

	const panel = page.getByRole('listbox', { name: 'Search results' });
	await expect(panel).toBeVisible();

	const box = await panel.boundingBox();
	const viewport = page.viewportSize()!;
	expect(box).not.toBeNull();
	// Left edge not off-screen, right edge within the viewport.
	expect(box!.x).toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);

	// The document itself must not scroll horizontally.
	const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(scrollW).toBeLessThanOrEqual(viewport.width);
});
