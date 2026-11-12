import { tick } from 'svelte';

/**
 * Moves the keyboard focus to the element `find` returns once Svelte has applied the pending
 * update, so a control that disappears (a panel that closes, a row that leaves a list) does not
 * drop the focus to the page. `find` runs after the update, so it can look up an element the
 * update created. A target that is not natively focusable needs `tabindex="-1"`.
 */
export async function focusAfterUpdate(find: () => HTMLElement | null | undefined): Promise<void> {
	await tick();
	find()?.focus();
}
