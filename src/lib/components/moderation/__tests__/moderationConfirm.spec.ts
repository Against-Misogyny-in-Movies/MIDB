import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODERATION_RULE_LABELS, moderationRule } from '#lib/media/utils/comments.ts';

vi.mock('$app/forms', () => ({
	enhance: (node: HTMLFormElement) => {
		const onSubmit = (event: Event) => event.preventDefault();
		node.addEventListener('submit', onSubmit);
		return { destroy: () => node.removeEventListener('submit', onSubmit) };
	}
}));

const { default: ModerationConfirm } = await import('../moderationConfirm.svelte');

afterEach(cleanup);

type Kind = 'hide' | 'reject' | 'mute' | 'ban' | 'unmute' | 'unban' | 'rejectAll';

function mount(kind: Kind, extra: Record<string, unknown> = {}) {
	return render(ModerationConfirm, {
		kind,
		name: 'anna',
		fields: { id: 'c1', userId: 'u1' },
		busy: null,
		submit: () => () => async () => {},
		oncancel: () => {},
		...extra
	} as never);
}

const radios = () => screen.queryAllByRole<HTMLInputElement>('radio');

describe('the rule radio group of a plate', () => {
	it.each(['hide', 'reject', 'mute', 'ban'] as const)('lists every rule in %s', (kind) => {
		mount(kind);
		expect(screen.getByRole('group', { name: 'Rule' })).toBeTruthy();
		expect(radios().map((r) => r.value)).toEqual([...moderationRule]);
		expect(radios().map((r) => r.parentElement?.textContent?.trim())).toEqual(
			moderationRule.map((rule) => MODERATION_RULE_LABELS[rule])
		);
		for (const radio of radios()) expect(radio.name).toBe('rule');
	});

	it.each(['unmute', 'unban', 'rejectAll'] as const)('is not in %s', (kind) => {
		mount(kind, { reportCount: 2 });
		expect(radios()).toHaveLength(0);
	});

	it('keeps the confirming button off until a rule is chosen, then posts it', async () => {
		mount('hide');
		const confirm = screen.getByRole('button', { name: 'Hide comment' }) as HTMLButtonElement;
		expect(confirm.disabled).toBe(true);
		await fireEvent.click(screen.getByLabelText('Trolling'));
		expect(confirm.disabled).toBe(false);
		const form = confirm.closest('form') as HTMLFormElement;
		expect(new FormData(form).get('rule')).toBe('trolling');
		expect(form.getAttribute('action')).toBe('?/hide');
	});

	it('names the note field after what happens to it', () => {
		mount('reject');
		expect(screen.getByLabelText('Note, shown to the author (optional)')).toBeTruthy();
		cleanup();
		mount('mute');
		expect(screen.getByLabelText('Note, kept in the log (optional)')).toBeTruthy();
		cleanup();
		mount('unban');
		expect(screen.getByLabelText('Note, kept in the log (optional)')).toBeTruthy();
	});

	it('serves the bulk bar: the rule posts to ?/bulk with the operation', async () => {
		mount('reject', { action: 'bulk', count: 3, fields: { op: 'reject', ids: ['a', 'b', 'c'] } });
		await fireEvent.click(screen.getByLabelText('Threat'));
		const confirm = screen.getByRole('button', { name: 'Reject 3 comments' }) as HTMLButtonElement;
		expect(confirm.disabled).toBe(false);
		const data = new FormData(confirm.closest('form') as HTMLFormElement);
		expect(data.get('rule')).toBe('threat');
		expect(data.get('op')).toBe('reject');
		expect(data.getAll('ids')).toEqual(['a', 'b', 'c']);
	});

	it('says the author sees the rule and the note', () => {
		mount('reject');
		expect(
			screen.getByText(/the author sees it as rejected, with the rule and the note/)
		).toBeTruthy();
	});
});
