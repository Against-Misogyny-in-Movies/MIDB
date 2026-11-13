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
		await waitFor(() => expect(shown()).toEqual(['success: Profile saved.']));
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
			expect(document.getElementById('username-hint')?.textContent).toMatch(/reserved/)
		);
		expect(field.getAttribute('aria-invalid')).toBe('true');
		expect(toasts.items).toEqual([]);

		await fireEvent.input(field, { target: { value: 'mary' } });
		expect(document.getElementById('username-hint')?.textContent).not.toMatch(/reserved/);
		expect(field.getAttribute('aria-invalid')).toBeNull();
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
