import { browser } from '$app/environment';
import type { PublicUser } from '$lib/media/types/user';

export type SessionStatus = 'pending' | 'anon' | 'user';
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** Hanko sets its `hanko` cookie from JS (not httpOnly), so its presence is readable. */
function hasHankoCookie(): boolean {
	return /(?:^|;\s*)hanko=/.test(document.cookie);
}

/**
 * Client-side session. SSR is user-agnostic (pages are CDN-cacheable), so the navbar starts
 * `pending` and resolves from `/api/me` once per full page load, or from `/user/*` layout
 * data via `set()`. Writes are browser-only: this is a module singleton, and on the server
 * it would be shared across requests.
 */
export class Session {
	status = $state<SessionStatus>('pending');
	user = $state<PublicUser | null>(null);
	/**
	 * First-paint guess while `pending`: picks the placeholder shape (avatar or "Sign in").
	 * Stays null through SSR and hydration so the server and client markup match.
	 */
	hint = $state<'user' | 'anon' | null>(null);

	#loading: Promise<void> | null = null;
	/** Bumped by set()/clear() so an in-flight /api/me response cannot overwrite them. */
	#generation = 0;

	/** Signed in, or probably signed in while the fetch is pending. */
	get likelyUser(): boolean {
		return this.status === 'user' || (this.status === 'pending' && this.hint === 'user');
	}

	/**
	 * Fetch `/api/me` once per page load; later calls (client navigations) reuse it. Skipped
	 * when `set()`/`clear()` already resolved the session (e.g. a full load of a /user/* page).
	 */
	load(fetcher: Fetcher = fetch): Promise<void> {
		if (!browser) return Promise.resolve();
		return (this.#loading ??= this.status === 'pending' ? this.#fetch(fetcher) : Promise.resolve());
	}

	set(user: PublicUser): void {
		if (!browser) return;
		this.#generation++;
		this.user = user;
		this.status = 'user';
	}

	clear(): void {
		if (!browser) return;
		this.#generation++;
		this.user = null;
		this.status = 'anon';
	}

	async #fetch(fetcher: Fetcher): Promise<void> {
		const generation = this.#generation;
		this.hint = hasHankoCookie() ? 'user' : 'anon';

		let user: PublicUser | null = null;
		try {
			const res = await fetcher('/api/me', { cache: 'no-store' });
			if (res.ok) user = (await res.json()) as PublicUser | null;
		} catch {
			// Network failure: fall through to signed out; the server still enforces auth.
		}

		if (generation !== this.#generation) return;
		this.user = user;
		this.status = user ? 'user' : 'anon';
	}
}

export const session = new Session();
