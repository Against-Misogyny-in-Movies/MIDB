import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
import { toasts } from '#lib/media/utils/toasts.svelte.js';

/** The fields an action that went through returned, for a message that reports counts. */
type DoneData = Record<string, unknown>;

const count = (value: unknown): number => (typeof value === 'number' ? value : 0);
const comments = (n: number) => `${n} ${n === 1 ? 'comment' : 'comments'}`;

/** What an action that went through says, by the action's name (`done`). */
const DONE: Record<string, string | ((data: DoneData) => string)> = {
	approve: 'Comment approved.',
	hide: 'Comment hidden.',
	reject: 'Comment rejected.',
	restore: 'Comment restored.',
	dismiss: 'Reports dismissed.',
	countReport: 'Community report counted.',
	rejectReport: 'Community report rejected.',
	rejectAccountReports: 'Every community report of the account is rejected.',
	mute: 'Account muted.',
	ban: 'Account banned.',
	resolveFlag: 'Marked resolved.',
	dismissFlag: 'Dismissed.',
	aiSearch: 'Filters set from the search.',
	scan: (data) => {
		const notChecked = count(data.notChecked);
		const lead = `Scan checked ${comments(count(data.checked))}: ${count(data.matched)} matched the concern.`;
		return notChecked > 0 ? `${lead} ${comments(notChecked)} not checked.` : lead;
	},
	bulk: (data) => {
		const refused = count(data.refused);
		const lead = `${comments(count(data.applied))} changed.`;
		return refused > 0 ? `${lead} ${comments(refused)} could not be changed.` : lead;
	}
};

/** The result of a moderation form, as `enhance` hands it over. */
type FormResult = { type: string; data?: Record<string, unknown> };

/**
 * Toasts a moderation form's result: the failure the action returned (`{ error }`), or what an
 * action that went through (`{ done }`) did.
 */
export function toastActionResult(result: FormResult): void {
	if (result.type === 'failure') {
		const error = result.data?.error;
		toasts.error(typeof error === 'string' ? error : 'The action failed. Try again in a moment.');
	} else if (result.type === 'success') {
		const done = result.data?.done;
		const message = typeof done === 'string' ? DONE[done] : undefined;
		if (message)
			toasts.success(typeof message === 'function' ? message(result.data ?? {}) : message);
	}
}

/**
 * The submit handler of a moderation row's form: it marks the action busy, lets the page update,
 * toasts the result, then puts the focus on the row if it is still there, else on its neighbour,
 * else on the element `fallbackId` names (by default the empty-state line).
 */
export function rowSubmit(
	root: () => HTMLElement | undefined,
	setBusy: (name: string | null) => void,
	afterUpdate?: () => void,
	fallbackId = 'moderation-empty'
) {
	return (name: string) => () => {
		setBusy(name);
		const row = root();
		const neighbour = row?.nextElementSibling ?? row?.previousElementSibling;
		return async ({ result, update }: { result: FormResult; update: () => Promise<void> }) => {
			await update();
			setBusy(null);
			afterUpdate?.();
			toastActionResult(result);
			await focusAfterUpdate(() =>
				row?.isConnected
					? row
					: ((neighbour?.isConnected ? (neighbour as HTMLElement) : null) ??
						document.getElementById(fallbackId))
			);
		};
	};
}
