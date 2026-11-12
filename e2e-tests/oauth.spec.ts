import { expect, test } from '@playwright/test';
import { devVar } from './support/env.ts';

// The Google values in .dev.vars are fakes (CI writes them): the spec checks the redirect
// MIDB asks for, and aborts the request, so Google is never contacted.
test.describe('Google sign-in', () => {
	test.skip(
		devVar('GOOGLE_CLIENT_ID') === undefined || devVar('GOOGLE_CLIENT_SECRET') === undefined,
		'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set in .dev.vars, so no Google button shows'
	);

	test('the button redirects to Google and no other provider shows', async ({ page }) => {
		await page.route('https://accounts.google.com/**', (route) => route.abort());
		await page.goto('/auth');
		await expect(page.getByRole('button', { name: 'Continue with Discord' })).toHaveCount(0);

		const redirect = page.waitForRequest((request) =>
			request.url().startsWith('https://accounts.google.com/')
		);
		await page.getByRole('button', { name: 'Continue with Google' }).click();
		const url = new URL((await redirect).url());

		expect(url.hostname).toBe('accounts.google.com');
		expect(url.searchParams.get('client_id')).toBe(devVar('GOOGLE_CLIENT_ID'));
		expect(url.searchParams.get('redirect_uri')).toBe(
			'http://localhost:4173/api/auth/callback/google'
		);
		expect(url.searchParams.get('state')).toBeTruthy();
	});
});

test('without a Discord client the page offers no Discord button', async ({ page }) => {
	test.skip(devVar('DISCORD_CLIENT_ID') !== undefined, 'Discord is configured in .dev.vars');
	await page.goto('/auth');
	await expect(page.getByRole('button', { name: 'Sign in with a passkey' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Continue with Discord' })).toHaveCount(0);
});
