import { afterEach, describe, expect, it, vi } from 'vitest';

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('#lib/media/utils/toasts.svelte.js', () => ({ toasts }));
const invalidateAll = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('$app/navigation', () => ({ invalidateAll }));

const { rowSubmit, toastActionResult } = await import('../rowSubmit.ts');

afterEach(() => {
	toasts.success.mockReset();
	toasts.error.mockReset();
	invalidateAll.mockClear();
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
		expect(toasts.success).toHaveBeenLastCalledWith('Scan checked 50 comments: 3 matched.');
		done({ done: 'scan', matched: 0, checked: 1, notChecked: 4 });
		expect(toasts.success).toHaveBeenLastCalledWith(
			'Scan checked 1 comment: 0 matched. 4 comments not checked.'
		);
	});

	it('reports a bulk action’s changes and refusals', () => {
		done({ done: 'bulk', applied: 12, refused: 0 });
		expect(toasts.success).toHaveBeenLastCalledWith('12 comments changed.');
		done({ done: 'bulk', applied: 1, refused: 1 });
		expect(toasts.success).toHaveBeenLastCalledWith(
			'1 comment changed. 1 comment could not be changed.'
		);
		done({ done: 'bulk', applied: 2, refused: 3, edited: 2 });
		expect(toasts.success).toHaveBeenLastCalledWith(
			'2 comments changed. 3 comments could not be changed: 2 edited after this page loaded.'
		);
	});

	it('confirms an AI search', () => {
		done({ done: 'aiSearch', params: 'q=x' });
		expect(toasts.success).toHaveBeenCalledWith('Filters set from the search.');
	});
});

describe('rowSubmit focus', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	/** Submits the form of a row whose element then leaves the page, and returns what holds the focus. */
	async function focusAfterRowLeaves(markup: string, fallbackIds?: string[]) {
		document.body.innerHTML = markup;
		const row = document.getElementById('row') as HTMLElement;
		const submit = rowSubmit(
			() => row,
			() => {},
			undefined,
			fallbackIds && (() => fallbackIds)
		);
		const handle = submit('approve')();
		await handle({
			result: { type: 'success', data: {} },
			update: async () => {
				row.remove();
			}
		});
		return document.activeElement?.id;
	}

	it('focuses a neighbour that takes focus', async () => {
		expect(
			await focusAfterRowLeaves('<ul><li id="row"></li><li id="next" tabindex="-1"></li></ul>')
		).toBe('next');
	});

	it('skips a neighbour that cannot take focus for the first fallback on the page', async () => {
		expect(
			await focusAfterRowLeaves(
				'<div id="row"></div><nav id="pager"></nav><div id="card" tabindex="-1"></div>',
				['gone', 'card']
			)
		).toBe('card');
	});
});

describe('rowSubmit refusal', () => {
	/** Submits a row's form and answers it with `result`. */
	async function submitWith(result: { type: string; data?: Record<string, unknown> }) {
		document.body.innerHTML = '<div id="row" tabindex="-1"></div>';
		const row = document.getElementById('row') as HTMLElement;
		const handle = rowSubmit(
			() => row,
			() => {}
		)('approve')();
		await handle({ result, update: async () => {} });
	}

	it('reloads the page data after a refused action, so the row shows what changed', async () => {
		await submitWith({ type: 'failure', data: { error: 'Edited.' } });
		expect(invalidateAll).toHaveBeenCalledOnce();
		expect(toasts.error).toHaveBeenCalledWith('Edited.');
	});

	it('leaves the data alone after an action that went through', async () => {
		await submitWith({ type: 'success', data: { done: 'approve' } });
		expect(invalidateAll).not.toHaveBeenCalled();
	});
});
