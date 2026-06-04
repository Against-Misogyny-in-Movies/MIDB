import { expect, test } from '@playwright/test';

test('hero headline and search input are visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('hero-headline')).toBeVisible();
    const search = page.getByPlaceholder('Search...');
    await expect(search).toBeVisible();
    await search.focus();
    await expect(search).toBeFocused();
});

test('contribute link points to /auth', async ({ page }) => {
    await page.goto('/');
    const link = page.getByTestId('contribute-link');
    await expect(link).toHaveAttribute('href', '/auth');
});

test('theme toggle switches between light and dark and persists across reload', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');
    const toggle = page.getByRole('button', { name: /Theme/i });

    // on load, data-theme is set by the toggle (light or dark, from system)
    const initial = await html.getAttribute('data-theme');
    expect(['light', 'dark']).toContain(initial);

    // click once → flips to the other value
    await toggle.click();
    const afterClick = await html.getAttribute('data-theme');
    expect(afterClick).not.toBe(initial);

    // reload — no-flash init script restores the persisted value
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', afterClick!);
});
