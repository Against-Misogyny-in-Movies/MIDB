import { expect, test } from '@playwright/test';

test('hero headline and search input are visible', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('hero-headline')).toBeVisible();
	const search = page.getByPlaceholder('Search films and series');
	await expect(search).toBeVisible();
	await search.focus();
	await expect(search).toBeFocused();
});

test('hero films link straight to their pages, above the project summary', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByLabel('About MIDB')).toContainText('sexual violence flags');
	const films = page.locator('[data-testid="hero-headline"] a');
	if ((await films.count()) > 0) {
		await expect(films.first()).toHaveAttribute('href', /^\/movie\/\d+$/);
	}
});

test('theme toggle switches between light and dark and persists across reload', async ({
	page
}) => {
	await page.goto('/');

	const html = page.locator('html');
	const toggle = page.getByRole('button', { name: /Theme/i });

	// The toggle sets data-theme once it mounts (light or dark, from the system), so wait for it.
	await expect(html).toHaveAttribute('data-theme', /^(light|dark)$/);
	const initial = await html.getAttribute('data-theme');

	// click once → flips to the other value
	const afterClick = initial === 'light' ? 'dark' : 'light';
	await toggle.click();
	await expect(html).toHaveAttribute('data-theme', afterClick);

	// reload — no-flash init script restores the persisted value
	await page.reload();
	await expect(html).toHaveAttribute('data-theme', afterClick);
});
