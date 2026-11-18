import type { AccountSession } from '#lib/media/types/sessions.ts';
import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
import { toasts } from '#lib/media/utils/toasts.svelte.js';

export const SESSIONS_HEADING_ID = 'sessions-heading';

/** The confirm plate under the list, as opposed to one under a row (`<session id>`). */
export const OTHERS = 'others';

/** Moves focus to an element by id, or to the card's heading when that element is gone. */
function focusOn(id: string) {
	return focusAfterUpdate(
		() => document.getElementById(id) ?? document.getElementById(SESSIONS_HEADING_ID)
	);
}

/**
 * State and actions of the Sessions card on `/user/settings`: the account's live sessions from
 * `GET /api/me/sessions`, the one open confirm plate and the action running. A result is a
 * toast. `initialCount` is what the page's load counted, which stands in for the list until it
 * arrives, so the first paint has the list's rows and knows whether there is anything to sign
 * out of.
 */
export class AccountSessions {
	#initialCount = $state(0);
	sessions = $state<AccountSession[]>([]);
	loading = $state(true);
	loadFailed = $state(false);
	/** The action running: a session's id, or `OTHERS`. */
	running = $state<string | null>(null);
	readonly busy = $derived(this.running !== null);
	/** The open confirm plate: a session's id, or `OTHERS`. */
	confirming = $state<string | null>(null);

	constructor(initialCount: number) {
		this.#initialCount = initialCount;
	}

	/** The rows the list has, or will have: the page's count until the list has loaded. */
	readonly rowCount = $derived(this.loading ? this.#initialCount : this.sessions.length);
	/** Whether another session exists to sign out. */
	readonly hasOthers = $derived(this.rowCount > 1);
	/** Labels used more than once: those rows show the time as well as the day. */
	readonly duplicateLabels = $derived(
		this.sessions.map((s) => s.label).filter((label, i, all) => all.indexOf(label) !== i)
	);

	async #fetchList(): Promise<boolean> {
		try {
			const response = await fetch('/api/me/sessions', { cache: 'no-store' });
			if (!response.ok) return false;
			this.sessions = (await response.json()) as AccountSession[];
			return true;
		} catch {
			return false;
		}
	}

	async load() {
		this.loadFailed = !(await this.#fetchList());
		this.loading = false;
	}

	openConfirm(key: string) {
		this.confirming = key;
		void focusOn(`confirm-session-${key}`);
	}

	closePlate(triggerId: string) {
		this.confirming = null;
		void focusOn(triggerId);
	}

	/** Runs one request, then reloads the list. Focus goes to the heading: the trigger is gone. */
	async #end(key: string, url: string, success: string, fallback: string) {
		this.running = key;
		let ok = false;
		try {
			ok = (await fetch(url, { method: 'DELETE' })).ok;
		} catch {
			ok = false;
		}
		if (!ok) {
			this.running = null;
			toasts.error(fallback);
			return;
		}
		this.confirming = null;
		toasts.success(success);
		// A failed reload leaves the list as it was; the next load shows the truth.
		await this.#fetchList();
		this.running = null;
		void focusOn(SESSIONS_HEADING_ID);
	}

	signOut(session: AccountSession) {
		return this.#end(
			session.id,
			`/api/me/sessions/${encodeURIComponent(session.id)}`,
			`Signed out ${session.label}.`,
			'The session could not be signed out. Try again.'
		);
	}

	signOutOthers() {
		return this.#end(
			OTHERS,
			'/api/me/sessions',
			'Signed out everywhere else.',
			'The other sessions could not be signed out. Try again.'
		);
	}
}
