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
vi.mock('$app/navigation', () => ({ replaceState: vi.fn() }));
vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/user/settings'), state: {} }
}));

const { default: SignInMethodsCard } = await import('../signInMethodsCard.svelte');

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

const mount = () => render(SignInMethodsCard, { providers: PROVIDERS });
const addPasskey = () => screen.getByRole('button', { name: 'Add a passkey' });

beforeEach(() => {
	lists([], []);
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('while the lists load', () => {
	it('shows busy skeleton rows and the add buttons, disabled', () => {
		auth.listAccounts.mockReturnValue(new Promise(() => {}));
		auth.listUserPasskeys.mockReturnValue(new Promise(() => {}));
		const { container } = mount();
		expect(screen.getByRole('heading', { name: 'Sign-in methods' })).toBeTruthy();
		expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
		expect(container.querySelectorAll('.skeleton-row')).toHaveLength(2);
		expect(screen.queryByText('Loading…')).toBeNull();
		expect(addPasskey()).toHaveProperty('disabled', true);
		expect(screen.getByRole('button', { name: 'Link Google' })).toHaveProperty('disabled', true);
		expect(screen.queryByText(/cannot be recovered/)).toBeNull();
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
	it('warns that the account cannot be recovered and explains the disabled Remove', async () => {
		lists([], [passkey()]);
		mount();
		const notice = await screen.findByText(/cannot be recovered/);
		expect(notice.getAttribute('id')).toBe('last-method-hint');
		const del = screen.getByRole('button', { name: 'Delete' });
		expect(del).toHaveProperty('disabled', true);
		expect(del.getAttribute('aria-describedby')).toBe('last-method-hint');
	});

	it('has no warning with two methods', async () => {
		lists([google], [passkey()]);
		mount();
		await screen.findByText('MacBook');
		expect(screen.queryByText(/cannot be recovered/)).toBeNull();
		expect(screen.getByRole('button', { name: 'Remove' })).toHaveProperty('disabled', false);
	});
});

describe('passkey rows', () => {
	it('say whether the passkey is synced, beside the Added date', async () => {
		lists(
			[google],
			[
				passkey({ id: 'p1', name: 'Phone', backedUp: true }),
				passkey({ id: 'p2', name: 'Laptop', backedUp: false })
			]
		);
		mount();
		expect(await screen.findByText('Synced · Added 02/11/2026')).toBeTruthy();
		expect(screen.getByText('This device only · Added 02/11/2026')).toBeTruthy();
	});
});

describe('a failed load', () => {
	it('shows the reload line as an alert', async () => {
		auth.listAccounts.mockResolvedValue({ data: null, error: { status: 500 } });
		mount();
		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('Reload the page');
	});
});
