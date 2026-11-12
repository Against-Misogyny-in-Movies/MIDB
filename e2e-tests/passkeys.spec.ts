import { expect, test } from '@playwright/test';
import { signUpWithPasskey } from './support/passkeys.ts';

test('a passkey creates an account, signs out and signs back in', async ({ page }) => {
	const username = await signUpWithPasskey(page);
	expect(username).toMatch(/^[a-z_]+_\d{4}$/);

	// The account page is the reader's own, so it is never stored.
	const profile = await page.goto('/user/profile');
	expect(profile?.headers()['cache-control']).toBe('private, no-store');
	await expect(page.getByLabel('Username')).toHaveValue(username);

	await page.getByRole('button', { name: 'Sign out' }).click();
	await page.waitForURL('**/auth');
	expect(await (await page.request.get('/api/me')).json()).toBeNull();

	// The virtual authenticator kept the passkey, so signing in needs no account name.
	await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
	await page.waitForURL('**/user/profile');
	const me = (await (await page.request.get('/api/me')).json()) as { username: string };
	expect(me.username).toBe(username);
});

test('the navbar shows the account on a public page right after signing in', async ({ page }) => {
	const username = await signUpWithPasskey(page, '/resources');
	await expect(page.locator('a.user-link')).toContainText(username);
	await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveCount(0);
});
