/** What a single key does on the moderation page. */
export type Shortcut =
	| 'next'
	| 'previous'
	| 'panel'
	| 'show'
	| 'approve'
	| 'dismiss'
	| 'restore'
	| 'hide'
	| 'reject'
	| 'account'
	| 'help';

const KEYS: Record<string, Shortcut> = {
	j: 'next',
	k: 'previous',
	Enter: 'panel',
	s: 'show',
	a: 'approve',
	d: 'dismiss',
	r: 'restore',
	h: 'hide',
	x: 'reject',
	u: 'account',
	'?': 'help'
};

/** What a shortcut is listed as: the keys and what they do, in the order the list shows them. */
export const SHORTCUT_LIST: { keys: string[]; does: string }[] = [
	{ keys: ['j', 'k'], does: 'Next and previous item' },
	{ keys: ['Enter'], does: 'Move the focus to the open item' },
	{ keys: ['s'], does: 'Show a collapsed comment' },
	{ keys: ['a'], does: 'Approve' },
	{ keys: ['d'], does: 'Dismiss reports' },
	{ keys: ['r'], does: 'Restore comment' },
	{ keys: ['h'], does: 'Hide, opens the rule list' },
	{ keys: ['x'], does: 'Reject, opens the rule list' },
	{ keys: ['u'], does: 'Open the account of the open item' },
	{ keys: ['Esc'], does: 'Close a rule list or this list' },
	{ keys: ['?'], does: 'This list' }
];

/** The `data-action` of the panel button a shortcut presses. */
const BUTTONS: Partial<Record<Shortcut, string>> = {
	show: 'reveal',
	approve: 'approve',
	dismiss: 'dismiss',
	restore: 'restore',
	hide: 'hide',
	reject: 'reject'
};

/** Where a key is typed into, or answers to: a shortcut leaves these alone. */
const KEEPS_KEYS =
	'input, select, textarea, [contenteditable]:not([contenteditable="false"]), .plate';

/**
 * The shortcut a key press is, or null. Single keys do nothing when the setting is off (WCAG
 * 2.1.4), while a modifier is held (Shift only for `?`), while an input method is composing, and
 * while the focus is in a field or a plate. Matching is on the key as typed, so a letter with Caps
 * Lock on or on another layout is not one.
 */
export function shortcutOf(event: KeyboardEvent, enabled: boolean): Shortcut | null {
	if (!enabled || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return null;
	if (!Object.hasOwn(KEYS, event.key)) return null;
	const shortcut = KEYS[event.key];
	if (event.shiftKey && shortcut !== 'help') return null;
	if (event.target instanceof Element && event.target.closest(KEEPS_KEYS)) return null;
	return shortcut;
}

/**
 * Presses the button a shortcut stands for inside `root` (an item's panel): the visible button is
 * the one path, so a key does what its button does and nothing where the button is absent or
 * disabled. Show comment answers only while the comment is collapsed. Returns whether it pressed.
 */
export function pressPanelButton(
	root: Pick<HTMLElement, 'querySelector'> | null | undefined,
	shortcut: Shortcut
): boolean {
	const action = BUTTONS[shortcut];
	const button = action && root?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
	if (!button || button.disabled) return false;
	if (shortcut === 'show' && button.getAttribute('aria-expanded') !== 'false') return false;
	button.click();
	return true;
}

/** Whether a shortcut presses a panel button rather than moving or opening something. */
export const pressesButton = (shortcut: Shortcut) => shortcut in BUTTONS;
