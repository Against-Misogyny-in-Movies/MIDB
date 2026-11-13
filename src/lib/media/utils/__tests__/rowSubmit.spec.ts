import { afterEach, describe, expect, it, vi } from 'vitest';

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('#lib/media/utils/toasts.svelte.js', () => ({ toasts }));

const { toastActionResult } = await import('../rowSubmit.ts');

afterEach(() => {
	toasts.success.mockReset();
	toasts.error.mockReset();
});

const done = (data: Record<string, unknown>) => toastActionResult({ type: 'success', data });

describe('toastActionResult', () => {
	it('says what a row action did, and what a refused one failed on', () => {
		done({ done: 'approve' });
		expect(toasts.success).toHaveBeenCalledWith('Comment approved.');
		toastActionResult({ type: 'failure', data: { error: 'Gone.' } });
		expect(toasts.error).toHaveBeenCalledWith('Gone.');
		toastActionResult({ type: 'failure' });
		expect(toasts.error).toHaveBeenLastCalledWith('The action failed. Try again in a moment.');
	});

	it('says nothing for an action it does not know', () => {
		done({ done: 'unknown' });
		done({});
		expect(toasts.success).not.toHaveBeenCalled();
	});

	it('reports a scan’s matches and the comments it did not check', () => {
		done({ done: 'scan', matched: 3, checked: 50, notChecked: 0 });
		expect(toasts.success).toHaveBeenLastCalledWith(
			'Scan checked 50 comments: 3 matched the concern.'
		);
		done({ done: 'scan', matched: 0, checked: 1, notChecked: 4 });
		expect(toasts.success).toHaveBeenLastCalledWith(
			'Scan checked 1 comment: 0 matched the concern. 4 comments not checked.'
		);
	});

	it('reports a bulk action’s changes and refusals', () => {
		done({ done: 'bulk', applied: 12, refused: 0 });
		expect(toasts.success).toHaveBeenLastCalledWith('12 comments changed.');
		done({ done: 'bulk', applied: 1, refused: 1 });
		expect(toasts.success).toHaveBeenLastCalledWith(
			'1 comment changed. 1 comment could not be changed.'
		);
	});

	it('confirms an AI search', () => {
		done({ done: 'aiSearch', params: 'q=x' });
		expect(toasts.success).toHaveBeenCalledWith('Filters set from the search.');
	});
});
