import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Result = { type: string; data?: Record<string, unknown> };

const form = vi.hoisted(() => ({
	result: { type: 'success', data: {} } as Result,
	/** Stands for the request in flight: the answer comes back when it resolves. */
	gate: async () => {}
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
			const handle = submit({ formData: new FormData(node) });
			void form.gate().then(() => handle({ result: form.result, update: async () => {} }));
		};
		node.addEventListener('submit', onSubmit);
		return { destroy: () => node.removeEventListener('submit', onSubmit) };
	}
}));

const { default: ProfileEditor } = await import('../profileEditor.svelte');
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
	form.gate = async () => {};
});

const onsaved = vi.fn();

function mount() {
	return render(ProfileEditor, { user: ME, onsaved, oncancel: vi.fn() });
}

describe('the rename warning', () => {
	it('names the address that stops working and the wait, once the name changes', async () => {
		mount();
		expect(document.getElementById('username-rename')).toBeNull();
		await fireEvent.input(screen.getByRole('textbox', { name: 'Username' }), {
			target: { value: 'maria' }
		});
		expect(document.getElementById('username-rename')?.textContent?.replace(/\s+/g, ' ')).toMatch(
			/After a rename, links to \/u\/mary stop working, and the username cannot change again for \d+ days\./
		);
	});

	it('leaves the wait out for staff, who have none', async () => {
		render(ProfileEditor, { user: { ...ME, role: 'moderator' }, onsaved, oncancel: vi.fn() });
		await fireEvent.input(screen.getByRole('textbox', { name: 'Username' }), {
			target: { value: 'maria' }
		});
		expect(document.getElementById('username-rename')?.textContent?.trim()).toBe(
			'After a rename, links to /u/mary stop working.'
		);
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
				'/user/settings/availability?username=alicezz',
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
		form.gate = () => new Promise<void>((r) => (release = r));
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
		mount();
		const field = screen.getByRole('textbox', { name: 'Username' });
		await fireEvent.input(field, { target: { value: 'admin' } });
		form.result = { type: 'failure', data: { error: 'username-reserved' } };
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
		expect(onsaved).toHaveBeenCalledWith({ ...ME, username: 'maria' });
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
