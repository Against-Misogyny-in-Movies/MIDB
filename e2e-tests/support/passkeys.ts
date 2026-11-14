import type { Page } from '@playwright/test';

/**
 * Gives the page a virtual authenticator (Chromium's WebAuthn emulation) that holds resident
 * keys and approves every prompt, so a passkey ceremony completes with no person present.
 */
export async function addVirtualAuthenticator(page: Page): Promise<void> {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			transport: 'internal',
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true
		}
	});
}

/**
 * Creates an account with a passkey alone and returns its generated username. The default
 * landing page makes no `/api/auth/*` request of its own, so sign-ups across the specs stay
 * under the auth rate limit (`RL_AUTH`), which counts every such request per address.
 */
export async function signUpWithPasskey(page: Page, next = '/resources'): Promise<string> {
	await addVirtualAuthenticator(page);
	await page.goto(`/auth?next=${encodeURIComponent(next)}`);
	await page.getByRole('button', { name: 'Create an account with a passkey' }).click();
	await page.waitForURL((url) => url.pathname + url.search === next);
	const response = await page.request.get('/api/me');
	const user = (await response.json()) as { username: string };
	return user.username;
}
