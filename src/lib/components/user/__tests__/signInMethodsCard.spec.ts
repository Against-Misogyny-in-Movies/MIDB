import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
	listAccounts: vi.fn(),
	listUserPasskeys: vi.fn()
}));

vi.mock('#lib/auth-client.ts', () => ({
	authClient: {
		listAccounts: auth.listAccounts,
		passkey: { listUserPasskeys: auth.listUserPasskeys }
	}
}));
const nav = vi.hoisted(() => ({ replaceState: vi.fn() }));
const pageState = vi.hoisted(() => ({
	url: new URL('http://localhost/user/settings'),
	state: {}
}));
vi.mock('$app/navigation', () => nav);
vi.mock('$app/state', () => ({ page: pageState }));

const { default: SignInMethodsCard } = await import('../signInMethodsCard.svelte');
const { toasts } = await import('#lib/media/utils/toasts.svelte.js');

const PROVIDERS = { google: true, discord: true };
const google = { id: 'a1', providerId: 'google', createdAt: '2026-11-02T10:00:00Z' };
const passkey = (over: Record<string, unknown> = {}) => ({
	id: 'p1',
	name: 'MacBook',
	createdAt: '2026-11-02T10:00:00Z',
	backedUp: false,
	...over
});

function lists(accounts: unknown[], passkeys: unknown[]) {
	auth.listAccounts.mockResolvedValue({ data: accounts, error: null });
	auth.listUserPasskeys.mockResolvedValue({ data: passkeys, error: null });
}

/** The counts the page's load hands the card: what it reserves rows for until the lists load. */
const mount = (initial = { linked: ['google'], passkeys: 1 }) =>
	render(SignInMethodsCard, { providers: PROVIDERS, initial });
const addPasskey = () => screen.getByRole('button', { name: 'Add a passkey' });

beforeEach(() => {
	lists([], []);
	pageState.url = new URL('http://localhost/user/settings');
});

afterEach(() => {
	cleanup();
	for (const toast of toasts.items) toasts.dismiss(toast.id);
	vi.clearAllMocks();
});

describe('while the lists load', () => {
	const hold = () => {
		auth.listAccounts.mockReturnValue(new Promise(() => {}));
		auth.listUserPasskeys.mockReturnValue(new Promise(() => {}));
	};

	it('shows one busy skeleton row per method the page counted, and the add buttons, disabled', () => {
		hold();
		const { container } = mount({ linked: ['google'], passkeys: 2 });
		expect(screen.getByRole('heading', { name: 'Sign-in methods' })).toBeTruthy();
		expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
		expect(screen.getByRole('status').textContent).toContain('Loading sign-in methods');
		expect(container.querySelectorAll('.skeleton-row')).toHaveLength(3);
		expect(addPasskey()).toHaveProperty('disabled', true);
		expect(screen.getByRole('button', { name: 'Link Discord' })).toHaveProperty('disabled', true);
	});

	it('has no button for a provider the page counted as linked', () => {
		hold();
		mount({ linked: ['google'], passkeys: 1 });
		expect(screen.queryByRole('button', { name: 'Link Google' })).toBeNull();
	});

	it('shows the sole-method notice at once when the page counted one method', () => {
		hold();
		mount({ linked: [], passkeys: 1 });
		expect(screen.getByText(/has one sign-in method/).getAttribute('id')).toBe('last-method-hint');
	});

	it('shows no notice when the page counted two methods', () => {
		hold();
		mount({ linked: ['google'], passkeys: 1 });
		expect(screen.queryByText(/has one sign-in method/)).toBeNull();
	});

	it('enables the add buttons once both lists have loaded', async () => {
		lists([google], [passkey()]);
		mount();
		await waitFor(() => expect(addPasskey()).toHaveProperty('disabled', false));
		expect(screen.queryByRole('button', { name: 'Link Google' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Link Discord' })).toBeTruthy();
	});
});

describe('a single sign-in method', () => {
	it('says what to do instead and explains the disabled Delete', async () => {
		lists([], [passkey()]);
		mount({ linked: [], passkeys: 1 });
		const notice = screen.getByText(
			/This account has one sign-in method, so it cannot be removed\. MIDB sends no recovery email: add another method so that losing this one does not lock the account\./
		);
		expect(notice.getAttribute('id')).toBe('last-method-hint');
		const del = await screen.findByRole('button', { name: 'Delete' });
		expect(del).toHaveProperty('disabled', true);
		expect(del.getAttribute('aria-describedby')).toBe('last-method-hint');
	});

	it('has no warning with two methods', async () => {
		lists([google], [passkey()]);
		mount();
		await screen.findByText('MacBook');
		expect(screen.queryByText(/has one sign-in method/)).toBeNull();
		expect(screen.getByRole('button', { name: 'Remove' })).toHaveProperty('disabled', false);
	});
});

describe('passkey rows', () => {
	it('say whether the passkey can sync, from its device type, after the Added date', async () => {
		lists(
			[google],
			[
				passkey({ id: 'p1', name: 'Phone', deviceType: 'multiDevice', backedUp: false }),
				passkey({ id: 'p2', name: 'Laptop', deviceType: 'singleDevice', backedUp: true })
			]
		);
		mount({ linked: ['google'], passkeys: 2 });
		expect(await screen.findByText('Added 02/11/2026 · Can sync between devices')).toBeTruthy();
		expect(screen.getByText('Added 02/11/2026 · This device only')).toBeTruthy();
	});
});

describe('a failed load', () => {
	it('shows the reload line as an alert and keeps the add row', async () => {
		auth.listAccounts.mockResolvedValue({ data: null, error: { status: 500 } });
		mount();
		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('Reload the page');
		expect(addPasskey()).toHaveProperty('disabled', false);
		expect(screen.getByRole('button', { name: 'Link Discord' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Link Google' })).toBeNull();
	});
});

describe('the result of a link, in the address', () => {
	const settled = () => waitFor(() => expect(addPasskey()).toHaveProperty('disabled', false));

	it('toasts a linked provider once and drops ?linked from the address', async () => {
		pageState.url = new URL('http://localhost/user/settings?linked=discord');
		lists([google], [passkey()]);
		mount();
		await settled();
		expect(toasts.items.map((t) => t.text)).toEqual(['Discord linked.']);
		expect(nav.replaceState).toHaveBeenCalledOnce();
		const [url] = nav.replaceState.mock.calls[0] as [URL];
		expect(url.search).toBe('');
		expect(url.pathname).toBe('/user/settings');
	});

	it('toasts a failed link once and drops ?error from the address', async () => {
		pageState.url = new URL('http://localhost/user/settings?error=access_denied');
		lists([google], [passkey()]);
		mount();
		await settled();
		expect(toasts.items.map((t) => t.text)).toEqual(['The provider sign-in was cancelled.']);
		expect(nav.replaceState).toHaveBeenCalledOnce();
		const [url] = nav.replaceState.mock.calls[0] as [URL];
		expect(url.search).toBe('');
	});

	it('toasts and rewrites nothing for a plain visit', async () => {
		lists([google], [passkey()]);
		mount();
		await settled();
		expect(toasts.items).toEqual([]);
		expect(nav.replaceState).not.toHaveBeenCalled();
	});
});
