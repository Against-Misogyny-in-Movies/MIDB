import { expect, test } from '@playwright/test';
import { signUpWithPasskey } from './support/passkeys.ts';

test('a passkey creates an account, signs out and signs back in', async ({ page }) => {
	const username = await signUpWithPasskey(page);
	expect(username).toMatch(/^[a-z_]+_\d{4}$/);

	// The settings page is the reader's own, so it is never stored.
	const settings = await page.goto('/user/settings');
	expect(settings?.headers()['cache-control']).toBe('private, no-store');
	await expect(page.getByRole('heading', { name: 'Email' })).toBeVisible();

	await page.getByRole('button', { name: 'Sign out' }).click();
	await page.waitForURL('**/auth');
	expect(await (await page.request.get('/api/me')).json()).toBeNull();

	// The virtual authenticator kept the passkey, so signing in needs no account name. It also
	// answers the page's autofill request at once, which can sign in before the button is
	// clicked: both are a passkey sign-in, so the click is a try and the profile page is the check.
	// The default return path, `/user/profile`, leads to the reader's own profile.
	const profileOpened = page.waitForURL(`**/u/${username}`);
	await page
		.getByRole('button', { name: 'Sign in with a passkey' })
		.click({ timeout: 3000 })
		.catch(() => undefined);
	await profileOpened;
	const me = (await (await page.request.get('/api/me')).json()) as { username: string };
	expect(me.username).toBe(username);
});

test('the navbar shows the account on a public page right after signing in', async ({ page }) => {
	const username = await signUpWithPasskey(page, '/resources');
	await expect(page.locator('a.user-link')).toContainText(username);
	await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toHaveCount(0);
});
