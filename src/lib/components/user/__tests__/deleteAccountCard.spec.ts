import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE_SESSION_MAX_AGE_MINUTES } from '#lib/media/utils/accountDeletion.ts';
import { RETIRED_USERNAME_DAYS } from '#lib/media/utils/username.ts';

const goto = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ goto }));
vi.mock('#lib/auth-client.ts', () => ({ authClient: { signOut } }));

const { default: DeleteAccountCard } = await import('../deleteAccountCard.svelte');
const { session } = await import('#lib/media/utils/session.svelte.js');
const { toasts } = await import('#lib/media/utils/toasts.svelte.js');

const fetchMock = vi.fn<typeof fetch>();
const clearSession = vi.spyOn(session, 'clear');

const mount = (sessionRecent = true) =>
	render(DeleteAccountCard, { username: 'Ada_1234', sessionRecent });

const open = async () => {
	await fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
};
const typeName = async (value: string) => {
	await fireEvent.input(screen.getByLabelText(/Type the username/), { target: { value } });
};
const submit = async () => {
	await fireEvent.click(screen.getByRole('button', { name: 'Delete account permanently' }));
};
const answer = (status: number, body: unknown = {}) =>
	fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	signOut.mockResolvedValue({ error: null });
	goto.mockResolvedValue(undefined);
});

afterEach(() => {
	cleanup();
	toasts.clear();
	vi.unstubAllGlobals();
	vi.resetAllMocks();
	clearSession.mockClear();
});

describe('the closed card', () => {
	it('states what is removed and what stays, with the retired-name wait from the code', () => {
		const { container } = mount();
		expect(screen.getByRole('heading', { name: 'Delete account' })).toBeTruthy();
		const text = (container.textContent ?? '').replace(/\s+/g, ' ');
		expect(text).toContain('takes effect at once and cannot be undone');
		expect(text).toContain('Removed:');
		expect(text).toContain('The email, sign-in methods and sessions.');
		expect(text).toContain(`cannot take the username for ${RETIRED_USERNAME_DAYS} days`);
		expect(text).toContain('Comments that no other account has replied below');
		expect(text).toContain('Kept:');
		expect(text).toContain('A comment that another account replied to, directly or further down');
		expect(container.querySelectorAll('li')).toHaveLength(4);
	});

	it('is a plain card with a ghost trigger and no form or plate', () => {
		const { container } = mount();
		const trigger = screen.getByRole('button', { name: 'Delete account' });
		expect(trigger.className).toContain('btn--ghost');
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		expect(container.querySelector('section')?.id).toBe('delete-account');
		expect(container.querySelector('input')).toBeNull();
	});
});

describe('the open plate', () => {
	it('opens under the button, links to Download data and moves focus into it', async () => {
		const { container } = mount();
		await open();
		const link = screen.getByRole('link', { name: "Download the account's data" });
		expect(link.getAttribute('href')).toBe('#account-data');
		expect(screen.getByRole('button', { name: 'Delete account', expanded: true })).toBeTruthy();
		await waitFor(() => expect(document.activeElement?.id).toBe('delete-account-plate'));
		const input = screen.getByLabelText('Type the username Ada_1234 to confirm');
		expect(input.getAttribute('autocomplete')).toBe('off');
		expect(input.getAttribute('spellcheck')).toBe('false');
		expect(container.querySelector('.btn--ink')?.textContent).toContain(
			'Delete account permanently'
		);
	});

	it('closes on Keep the account, clears the field and returns focus to the trigger', async () => {
		mount();
		await open();
		await typeName('ada');
		await fireEvent.click(screen.getByRole('button', { name: 'Keep the account' }));
		expect(screen.queryByLabelText(/Type the username/)).toBeNull();
		await waitFor(() => expect(document.activeElement?.id).toBe('delete-account-trigger'));
		await open();
		expect(screen.getByLabelText<HTMLInputElement>(/Type the username/).value).toBe('');
	});

	it('trims and lowercases the field as it is typed', async () => {
		mount();
		await open();
		await typeName('  ADA_1234 ');
		expect(screen.getByLabelText<HTMLInputElement>(/Type the username/).value).toBe('ada_1234');
	});
});

describe('the client check', () => {
	it('reports an empty field in the error line and sends nothing', async () => {
		mount();
		await open();
		await submit();
		const input = screen.getByLabelText(/Type the username/);
		expect(document.getElementById('delete-username-error')?.textContent).toBe(
			'Type the username to confirm.'
		);
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(input.getAttribute('aria-describedby')).toBe('delete-username-error');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('reports a wrong name, and clears the line when the field changes', async () => {
		mount();
		await open();
		await typeName('grace');
		await submit();
		expect(document.getElementById('delete-username-error')?.textContent).toBe(
			'That is not the username.'
		);
		expect(fetchMock).not.toHaveBeenCalled();
		await typeName('grace_');
		expect(document.getElementById('delete-username-error')?.textContent).toBe('');
		expect(screen.getByLabelText(/Type the username/).getAttribute('aria-invalid')).toBeNull();
	});
});

describe('deleting', () => {
	it('sends the typed username as JSON, then clears the session, goes home and toasts', async () => {
		answer(200, { ok: true });
		mount();
		await open();
		await typeName('ada_1234');
		await submit();
		await waitFor(() => expect(toasts.items).toHaveLength(1));
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/me/account');
		expect(init?.method).toBe('DELETE');
		expect(JSON.parse(init?.body as string)).toEqual({ username: 'ada_1234' });
		expect(clearSession).toHaveBeenCalledOnce();
		expect(goto).toHaveBeenCalledWith('/', { refreshAll: true });
		expect(toasts.items[0]).toMatchObject({ tone: 'success', text: 'The account was deleted.' });
	});

	it('marks the delete button busy while the request runs and sends once', async () => {
		fetchMock.mockReturnValue(new Promise(() => {}));
		mount();
		await open();
		await typeName('ada_1234');
		await submit();
		const button = screen.getByRole('button', { name: 'Delete account permanently' });
		await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('true'));
		expect(button).toHaveProperty('disabled', false);
		await submit();
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(screen.getByRole('button', { name: 'Keep the account' })).toHaveProperty(
			'disabled',
			true
		);
	});

	it('shows a username-mismatch answer in the field', async () => {
		answer(422, { error: 'username-mismatch' });
		mount();
		await open();
		await typeName('ada_1234');
		await submit();
		await waitFor(() =>
			expect(document.getElementById('delete-username-error')?.textContent).toBe(
				'That is not the username.'
			)
		);
		expect(goto).not.toHaveBeenCalled();
	});

	it('replaces the form with the sign-in notice on a session-stale answer', async () => {
		answer(403, { error: 'session-stale' });
		mount();
		await open();
		await typeName('ada_1234');
		await submit();
		await screen.findByText(new RegExp(`last ${DELETE_SESSION_MAX_AGE_MINUTES} minutes`));
		expect(screen.queryByLabelText(/Type the username/)).toBeNull();
		expect(screen.getByRole('button', { name: 'Sign out and sign in again' })).toBeTruthy();
		await waitFor(() => expect(document.activeElement?.id).toBe('delete-account-notice'));
	});

	it('replaces the form with the administrator notice on a last-administrator answer', async () => {
		answer(409, { error: 'last-administrator' });
		mount();
		await open();
		await typeName('ada_1234');
		await submit();
		await screen.findByText(/The only administrator cannot delete the account/);
		expect(screen.getByText(/Another administrator has to exist first/)).toBeTruthy();
		expect(screen.queryByLabelText(/Type the username/)).toBeNull();
		expect(screen.queryByRole('link', { name: "Download the account's data" })).toBeNull();
		await waitFor(() => expect(document.activeElement?.id).toBe('delete-account-notice'));
		expect(screen.queryByRole('button', { name: 'Delete account', expanded: true })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Keep the account' })).toBeTruthy();
	});

	it('goes to sign-in on a 401, with the session cleared', async () => {
		answer(401, { message: 'Unauthorized' });
		mount();
		await open();
		await typeName('ada_1234');
		await submit();
		await waitFor(() => expect(goto).toHaveBeenCalledWith('/auth', { refreshAll: true }));
		expect(clearSession).toHaveBeenCalledOnce();
	});

	it('toasts an error on a 429 and leaves the plate open', async () => {
		answer(429, { message: 'Too many requests' });
		mount();
		await open();
		await typeName('ada_1234');
		await submit();
		await waitFor(() => expect(toasts.items).toHaveLength(1));
		expect(toasts.items[0]).toMatchObject({
			tone: 'error',
			text: 'Too many attempts. Try again in a minute.'
		});
		expect(screen.getByLabelText(/Type the username/)).toBeTruthy();
		expect(goto).not.toHaveBeenCalled();
	});

	it('toasts an error on any other failure, a thrown request included', async () => {
		answer(500, { message: 'boom' });
		mount();
		await open();
		await typeName('ada_1234');
		await submit();
		await waitFor(() => expect(toasts.items).toHaveLength(1));
		expect(toasts.items[0].text).toBe('The account could not be deleted. Try again.');

		toasts.clear();
		fetchMock.mockRejectedValue(new TypeError('offline'));
		await submit();
		await waitFor(() => expect(toasts.items).toHaveLength(1));
		expect(toasts.items[0].tone).toBe('error');
		expect(clearSession).not.toHaveBeenCalled();
	});
});

describe('a session that is too old at load', () => {
	it('shows the notice in place of the form, naming the limit from the code', async () => {
		mount(false);
		await open();
		expect(
			screen.getByText(
				new RegExp(`sign-in from the last ${DELETE_SESSION_MAX_AGE_MINUTES} minutes`)
			)
		).toBeTruthy();
		expect(screen.queryByLabelText(/Type the username/)).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('signs out, clears the session and goes to sign-in with this card as the return path', async () => {
		mount(false);
		await open();
		await fireEvent.click(screen.getByRole('button', { name: 'Sign out and sign in again' }));
		await waitFor(() => expect(goto).toHaveBeenCalled());
		expect(signOut).toHaveBeenCalledOnce();
		expect(clearSession).toHaveBeenCalledOnce();
		expect(goto).toHaveBeenCalledWith('/auth?next=%2Fuser%2Fsettings%23delete-account', {
			refreshAll: true
		});
	});

	it('stays signed in and toasts when the sign-out fails', async () => {
		signOut.mockResolvedValue({ error: { message: 'x' } });
		mount(false);
		await open();
		await fireEvent.click(screen.getByRole('button', { name: 'Sign out and sign in again' }));
		await waitFor(() => expect(toasts.items).toHaveLength(1));
		expect(toasts.items[0].tone).toBe('error');
		expect(goto).not.toHaveBeenCalled();
		expect(clearSession).not.toHaveBeenCalled();
	});
});
