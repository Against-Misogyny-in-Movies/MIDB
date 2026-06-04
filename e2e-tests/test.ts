import { expect, test } from '@playwright/test';

test('index page has hero headline', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('hero-headline')).toBeVisible();
});
