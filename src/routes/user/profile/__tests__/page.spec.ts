import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Result = { type: string; data?: Record<string, unknown> };

const form = vi.hoisted(() => ({
	result: { type: 'success', data: {} } as Result,
	/** Stands for the page taking the action's answer: the `form` prop it would set. */
	update: async () => {}
}));

// `enhance` runs the page's submit function with the form's data, then its result handler.
vi.mock('$app/forms', () => ({
	enhance: (
		node: HTMLFormElement,
		submit: (input: {
			formData: FormData;
		}) => (opts: { result: Result; update: () => Promise<void> }) => Promise<void>
	) => {
		const onSubmit = (event: Event) => {
			event.preventDefault();
			void submit({ formData: new FormData(node) })({
				result: form.result,
				update: () => form.update()
			});
		};
		node.addEventListener('submit', onSubmit);
		return { destroy: () => node.removeEventListener('submit', onSubmit) };
	}
}));

const { default: Page } = await import('../+page.svelte');
const { toasts } = await import('#lib/media/utils/toasts.svelte.js');

const ME = {
	id: 'me',
	username: 'mary',
	avatarKey: null,
	role: 'user' as const,
	displayName: 'mary'
};
const shown = () => toasts.items.map((t) => `${t.tone}: ${t.text}`);

afterEach(() => {
	cleanup();
	toasts.clear();
	form.result = { type: 'success', data: {} };
	form.update = async () => {};
});

function mount() {
	return render(Page, { data: { me: ME, email: null }, form: null } as never);
}

describe('the public profile link', () => {
	it('links the reader’s own public profile', () => {
		mount();
		expect(screen.getByRole('link', { name: /Public profile/ }).getAttribute('href')).toBe(
			'/u/mary'
		);
	});

	it('is absent for an account with no username', () => {
		render(Page, { data: { me: { ...ME, username: null }, email: null }, form: null } as never);
		expect(screen.queryByRole('link', { name: /Public profile/ })).toBeNull();
	});
});

describe('the username field', () => {
	it('states the new rule and enforces it on a changed name only', async () => {
		mount();
		const field = screen.getByRole('textbox', { name: 'Username' }) as HTMLInputElement;
		expect(field.getAttribute('maxlength')).toBe('32');
		expect(field.hasAttribute('pattern')).toBe(false);
		expect(field.hasAttribute('minlength')).toBe(false);
		expect(document.getElementById('username-rule')?.textContent).toMatch(
			/A new username is 4–32 characters: lowercase letters, numbers and single underscores\. It starts with a letter and does not end with an underscore\./
		);
		expect(document.getElementById('username-status')?.textContent).toBe('');
		expect(field.closest('form')?.hasAttribute('novalidate')).toBe(true);
		expect(field.hasAttribute('title')).toBe(false);

		await fireEvent.input(field, { target: { value: 'ab' } });
		expect(field.getAttribute('minlength')).toBe('4');
		expect(field.getAttribute('pattern')).toBe('[a-z][a-z0-9]*(_[a-z0-9]+)*');
	});
});

describe('the username field as the reader types', () => {
	it('trims and lowercases the value, and checks the lowercased name', async () => {
		const fetcher = vi.fn(async () => Response.json({ available: true, reason: 'available' }));
		vi.stubGlobal('fetch', fetcher);
		try {
			mount();
			const field = screen.getByRole('textbox', { name: 'Username' }) as HTMLInputElement;
			await fireEvent.input(field, { target: { value: ' Alicezz ' } });
			expect(field.value).toBe('alicezz');
			await waitFor(() =>
				expect(document.getElementById('username-status')?.textContent).toBe('Available')
			);
			expect(fetcher).toHaveBeenCalledWith(
				'/user/profile/availability?username=alicezz',
				expect.anything()
			);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('shows each availability reason as its own text in the live slot', async () => {
		const reasons: Record<string, RegExp> = {
			taken:
				/or one that looks like it, belongs to another account or was given up in the last \d+ days\.$/,
			reserved: /^That username is reserved\.$/,
			blocked: /^That username is not allowed\.$/
		};
		for (const [reason, text] of Object.entries(reasons)) {
			vi.stubGlobal(
				'fetch',
				vi.fn(async () => Response.json({ available: false, reason }))
			);
			const view = mount();
			const field = screen.getByRole('textbox', { name: 'Username' });
			await fireEvent.input(field, { target: { value: 'someone' } });
			await waitFor(() =>
				expect(document.getElementById('username-status')?.textContent).toMatch(text)
			);
			expect(field.getAttribute('aria-invalid')).toBe('true');
			view.unmount();
			vi.unstubAllGlobals();
		}
	});

	it('marks a name that breaks the shape invalid once the field is left, with the rule line', async () => {
		mount();
		const field = screen.getByRole('textbox', { name: 'Username' });
		await fireEvent.input(field, { target: { value: 'bad-name' } });
		expect(field.getAttribute('aria-invalid')).toBeNull();
		await fireEvent.blur(field);
		expect(field.getAttribute('aria-invalid')).toBe('true');
		expect(document.getElementById('username-rule')?.classList.contains('hint--taken')).toBe(true);
	});
});

describe('saving the profile', () => {
	it('toasts a save that went through, and shows the button busy while it runs', async () => {
		let release!: () => void;
		form.update = () => new Promise<void>((r) => (release = r));
		mount();
		const save = screen.getByRole('button', { name: 'Save profile' });
		await fireEvent.submit(save.closest('form')!);
		await waitFor(() => expect(save.getAttribute('aria-busy')).toBe('true'));
		expect((save as HTMLButtonElement).disabled).toBe(false);
		release();
		await waitFor(() =>
			expect(shown()).toEqual([
				'warn: Nothing changed: the username and avatar are the ones already saved.'
			])
		);
		expect(save.getAttribute('aria-busy')).toBe('false');
	});

	it('shows a refused username under its field, not as a toast, while the field still holds it', async () => {
		const view = mount();
		const field = screen.getByRole('textbox', { name: 'Username' });
		await fireEvent.input(field, { target: { value: 'admin' } });
		form.result = { type: 'failure', data: { error: 'username-reserved' } };
		form.update = async () => {
			await view.rerender({ data: { me: ME, email: null }, form: { error: 'username-reserved' } });
		};
		await fireEvent.submit(field.closest('form')!);
		await waitFor(() =>
			expect(document.getElementById('username-status')?.textContent).toMatch(/reserved/)
		);
		expect(field.getAttribute('aria-invalid')).toBe('true');
		expect(toasts.items).toEqual([]);

		await fireEvent.input(field, { target: { value: 'mary' } });
		expect(document.getElementById('username-status')?.textContent).not.toMatch(/reserved/);
		expect(field.getAttribute('aria-invalid')).toBeNull();
	});

	it('shows a refused rename in place of Available, with no toast', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json({ available: true, reason: 'available' }))
		);
		try {
			mount();
			const field = screen.getByRole('textbox', { name: 'Username' });
			await fireEvent.input(field, { target: { value: 'maria' } });
			await waitFor(() =>
				expect(document.getElementById('username-status')?.textContent).toBe('Available')
			);
			form.result = { type: 'failure', data: { error: 'username-too-soon' } };
			await fireEvent.submit(field.closest('form')!);
			await waitFor(() =>
				expect(document.getElementById('username-status')?.textContent).toMatch(
					/once every \d+ days/
				)
			);
			expect(toasts.items).toEqual([]);
			expect(field.getAttribute('aria-invalid')).toBe('true');
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('says what a save changed, as the server stored it', async () => {
		form.result = { type: 'success', data: { success: true, me: { ...ME, username: 'maria' } } };
		mount();
		const field = screen.getByRole('textbox', { name: 'Username' });
		await fireEvent.input(field, { target: { value: 'Maria' } });
		await fireEvent.submit(field.closest('form')!);
		await waitFor(() => expect(shown()).toEqual(['success: Username changed to maria.']));
	});

	it('toasts a refused avatar', async () => {
		form.result = { type: 'failure', data: { error: 'avatar-invalid' } };
		mount();
		await fireEvent.submit(screen.getByRole('button', { name: 'Save profile' }).closest('form')!);
		await waitFor(() =>
			expect(shown()).toEqual(['error: That avatar is not available. Choose another.'])
		);
	});
});
