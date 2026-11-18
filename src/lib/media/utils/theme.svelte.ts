/** The reader's choice: a fixed theme, or `system` to follow the device's setting. */
export type ThemeChoice = 'system' | 'light' | 'dark';

/** The theme the page is drawn in. */
export type ResolvedTheme = 'light' | 'dark';

/** The choices in the order the settings control lists them. */
export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

/** The `localStorage` key. No value means `system`; `static/theme-init.js` reads the same key before first paint. */
export const THEME_STORAGE_KEY = 'theme';

// --surface per theme; keep in sync with app.css and static/theme-init.js.
const CHROME: Record<ResolvedTheme, string> = { light: '#fbfafc', dark: '#141217' };

function readStored(): ThemeChoice {
	try {
		const value = localStorage.getItem(THEME_STORAGE_KEY);
		return value === 'light' || value === 'dark' ? value : 'system';
	} catch {
		// Storage unreadable: the page follows the system theme.
		return 'system';
	}
}

function writeStored(choice: ThemeChoice) {
	try {
		if (choice === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
		else localStorage.setItem(THEME_STORAGE_KEY, choice);
	} catch {
		// Storage unwritable: the choice holds until the page closes.
	}
}

/**
 * The theme, shared by the navbar toggle and the settings control. A fixed choice pins
 * `data-theme` on the root and is kept in `localStorage`; `system` removes both, so the page
 * follows `prefers-color-scheme` as it changes. The stored value is only known in the browser,
 * so the server renders `system` and `start` reads the rest; the pre-paint script
 * (`static/theme-init.js`) has already set `data-theme` by then, so the page does not flash.
 */
export class ThemeState {
	choice = $state<ThemeChoice>('system');
	/** Whether the device prefers dark, tracked live. */
	systemDark = $state(false);
	/** What the page is drawn in now. */
	readonly resolved = $derived<ResolvedTheme>(
		this.choice === 'system' ? (this.systemDark ? 'dark' : 'light') : this.choice
	);
	#listening = false;

	/**
	 * Reads the stored choice and the device's preference, and applies them. Browser only; safe to
	 * call from every component that shows the theme, and again after the stored value changed.
	 */
	start() {
		if (typeof window === 'undefined') return;
		const query = window.matchMedia('(prefers-color-scheme: dark)');
		this.choice = readStored();
		this.systemDark = query.matches;
		if (!this.#listening) {
			this.#listening = true;
			query.addEventListener('change', (event) => {
				this.systemDark = event.matches;
				this.#apply();
			});
		}
		this.#apply();
	}

	/** Makes `choice` the theme and keeps it for the next visit (`system` keeps nothing). */
	set(choice: ThemeChoice) {
		this.choice = choice;
		writeStored(choice);
		this.#apply();
	}

	/** The navbar toggle: the other of light and dark, as a fixed choice. */
	toggle() {
		this.set(this.resolved === 'dark' ? 'light' : 'dark');
	}

	#apply() {
		const root = document.documentElement;
		if (this.choice === 'system') delete root.dataset.theme;
		else root.dataset.theme = this.choice;
		// Keep the mobile browser chrome tint in step with the theme in use.
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', CHROME[this.resolved]);
	}
}

export const theme = new ThemeState();
