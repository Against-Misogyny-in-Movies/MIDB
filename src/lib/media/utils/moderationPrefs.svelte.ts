/** The `localStorage` keys. A value is stored only when the setting is off; on is the default. */
export const COLLAPSE_SEVERE_KEY = 'moderation-collapse-severe';
export const SHORTCUTS_KEY = 'moderation-shortcuts';

function readOn(key: string): boolean {
	try {
		return localStorage.getItem(key) !== 'off';
	} catch {
		// Storage unreadable: the default stands.
		return true;
	}
}

function writeOn(key: string, on: boolean) {
	try {
		if (on) localStorage.removeItem(key);
		else localStorage.setItem(key, 'off');
	} catch {
		// Storage unwritable: the choice holds until the page closes.
	}
}

/**
 * A moderator's settings, kept in the browser and shared by the page header's controls, the queue
 * and the key handlers. They default to on. The stored value is only known in the browser, so the server
 * renders the default and `start` reads the rest.
 */
export class ModerationPrefs {
	/** Whether a comment at or above the reject severity starts collapsed. */
	collapseSevere = $state(true);
	/** Whether single-key shortcuts act (WCAG 2.1.4: they can be switched off). */
	shortcuts = $state(true);

	/** Reads the stored settings. Browser only; safe to call from every component that shows them. */
	start() {
		if (typeof window === 'undefined') return;
		this.collapseSevere = readOn(COLLAPSE_SEVERE_KEY);
		this.shortcuts = readOn(SHORTCUTS_KEY);
	}

	setCollapseSevere(on: boolean) {
		this.collapseSevere = on;
		writeOn(COLLAPSE_SEVERE_KEY, on);
	}

	setShortcuts(on: boolean) {
		this.shortcuts = on;
		writeOn(SHORTCUTS_KEY, on);
	}
}

export const moderationPrefs = new ModerationPrefs();
