import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
import { toasts } from '#lib/media/utils/toasts.svelte.js';

/** What an action that went through says, by the action's name (`done`); the others show their result in the queue itself. */
const DONE: Record<string, string> = {
	rejectAccountReports: 'Every community report of the account is rejected.',
	mute: 'Account muted.',
	ban: 'Account banned.',
	resolveFlag: 'Marked resolved.',
	dismissFlag: 'Dismissed.'
};

/** The result of a moderation form, as `enhance` hands it over. */
type FormResult = { type: string; data?: Record<string, unknown> };

/**
 * Toasts a moderation form's result: the failure the action returned (`{ error }`), or what an
 * action that went through (`{ done }`) did, when the queue does not show it.
 */
export function toastActionResult(result: FormResult): void {
	if (result.type === 'failure') {
		const error = result.data?.error;
		toasts.error(typeof error === 'string' ? error : 'The action failed. Try again in a moment.');
	} else if (result.type === 'success') {
		const done = result.data?.done;
		if (typeof done === 'string' && DONE[done]) toasts.success(DONE[done]);
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
