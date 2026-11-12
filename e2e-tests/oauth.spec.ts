import { expect, test } from '@playwright/test';
import { devVar } from './support/env.ts';

// The Google and Discord values in .dev.vars are fakes (CI writes them): a spec checks the
// redirect MIDB asks for, and aborts the request, so the provider is never contacted.
test.describe('Google sign-in', () => {
	test.skip(
		devVar('GOOGLE_CLIENT_ID') === undefined || devVar('GOOGLE_CLIENT_SECRET') === undefined,
		'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set in .dev.vars, so no Google button shows'
	);

	test('the button redirects to Google', async ({ page }) => {
		await page.route('https://accounts.google.com/**', (route) => route.abort());
		await page.goto('/auth');

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

test.describe('Discord sign-in', () => {
	test.skip(
		devVar('DISCORD_CLIENT_ID') === undefined || devVar('DISCORD_CLIENT_SECRET') === undefined,
		'DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET are not set in .dev.vars, so no Discord button shows'
	);

	test('the button redirects to Discord', async ({ page }) => {
		await page.route('https://discord.com/**', (route) => route.abort());
		await page.goto('/auth');

		const redirect = page.waitForRequest((request) =>
			request.url().startsWith('https://discord.com/')
		);
		await page.getByRole('button', { name: 'Continue with Discord' }).click();
		const url = new URL((await redirect).url());

		expect(url.hostname).toBe('discord.com');
		expect(url.searchParams.get('client_id')).toBe(devVar('DISCORD_CLIENT_ID'));
		expect(url.searchParams.get('redirect_uri')).toBe(
			'http://localhost:4173/api/auth/callback/discord'
		);
	});
});

test('without a Discord client the page offers no Discord button', async ({ page }) => {
	test.skip(devVar('DISCORD_CLIENT_ID') !== undefined, 'Discord is configured in .dev.vars');
	await page.goto('/auth');
	await expect(page.getByRole('button', { name: 'Sign in with a passkey' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Continue with Discord' })).toHaveCount(0);
});
