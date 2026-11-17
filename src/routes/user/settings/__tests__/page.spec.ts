import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('#lib/auth-client.ts', () => ({
	authClient: {
		listAccounts: vi.fn(() => new Promise(() => {})),
		passkey: { listUserPasskeys: vi.fn(() => new Promise(() => {})) },
		signOut: vi.fn()
	}
}));
vi.mock('$app/navigation', () => ({ replaceState: vi.fn(), goto: vi.fn() }));
vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/user/settings'), state: {} }
}));

const { default: Page } = await import('../+page.svelte');
const serverModule = await import('../+page.server.ts');

const ME = {
	id: 'u1',
	username: 'ada_1234',
	avatarKey: null,
	role: 'user' as const,
	displayName: 'ada_1234'
};

const METHODS = { linked: ['google'], passkeys: 1 };

function mount(
	data: { email: string | null },
	providers: { google: boolean; discord: boolean } = { google: true, discord: false }
) {
	return render(Page, {
		data: { me: ME, providers, methods: METHODS, ...data }
	} as Parameters<typeof render<typeof Page>>[1]);
}

afterEach(cleanup);

describe('the settings route', () => {
	it('renders on the server: its load does not turn SSR off', () => {
		expect('ssr' in serverModule).toBe(false);
	});
});

describe('the settings page', () => {
	it('names whose settings these are and links to the public profile', () => {
		mount({ email: 'ada@example.org' });
		expect(screen.getByText('ada_1234')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'View profile' }).getAttribute('href')).toBe(
			'/u/ada_1234'
		);
		expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
	});

	it('lists its sections in "On this page" and gives each an id', () => {
		mount({ email: 'ada@example.org' });
		const nav = screen.getByRole('navigation', { name: 'On this page' });
		const hrefs = [...nav.querySelectorAll('a')].map((a) => a.getAttribute('href'));
		expect(hrefs).toEqual(['#email', '#sign-in-methods']);
		for (const href of hrefs) expect(document.querySelector(href!)).toBeTruthy();
	});

	it('says where the email comes from, from the providers this deployment offers', () => {
		mount({ email: 'ada@example.org' });
		expect(screen.getByText('ada@example.org')).toBeTruthy();
		expect(
			screen.getByText(
				'Taken from the first Google account used with it, and fixed after that. Not shown on the profile or on comments.'
			)
		).toBeTruthy();
	});

	it('names both providers when both are offered', () => {
		mount({ email: 'ada@example.org' }, { google: true, discord: true });
		expect(screen.getByText(/the first Google or Discord account used with it/)).toBeTruthy();
	});

	it('drops the provider sentence when none is offered', () => {
		mount({ email: 'ada@example.org' }, { google: false, discord: false });
		expect(screen.getByText('Not shown on the profile or on comments.')).toBeTruthy();
	});

	it('says so when the account has no email, naming the offered providers', () => {
		mount({ email: null });
		expect(
			screen.getByText('This account has no email. Linking a Google account can add one.')
		).toBeTruthy();
	});

	it('says only that the account has no email when no provider is offered', () => {
		mount({ email: null }, { google: false, discord: false });
		expect(screen.getByText('This account has no email.')).toBeTruthy();
	});
});
