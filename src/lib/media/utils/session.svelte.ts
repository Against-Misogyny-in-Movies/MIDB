import { browser } from '$app/env';
import type { PublicUser } from '#lib/media/types/user.ts';

export type SessionStatus = 'pending' | 'anon' | 'user';
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** The readable marker for "probably signed in", so the navbar's first paint needs no request. */
const HINT_COOKIE = 'midb_hint';
/** The length of a Better Auth session (`session.expiresIn` default). */
const HINT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * `midb_hint=1` holds no identity and no secret: it only picks the navbar placeholder while
 * `/api/me` is pending. The server never reads it and the session cookie stays httpOnly, so
 * a stale or forged hint changes the first paint and nothing else.
 */
function hasHint(): boolean {
	return new RegExp(`(?:^|;\\s*)${HINT_COOKIE}=1(?:;|$)`).test(document.cookie);
}

function writeHint(signedIn: boolean): void {
	const secure = location.protocol === 'https:' ? '; Secure' : '';
	const lifetime = signedIn ? `max-age=${HINT_MAX_AGE_SECONDS}` : 'max-age=0';
	document.cookie = `${HINT_COOKIE}=${signedIn ? '1' : ''}; path=/; ${lifetime}; SameSite=Lax${secure}`;
	// The pre-paint script in app.html sets the same attribute on a full page load.
	if (signedIn) document.documentElement.dataset.hint = 'user';
	else delete document.documentElement.dataset.hint;
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
		writeHint(true);
	}

	clear(): void {
		if (!browser) return;
		this.#generation++;
		this.user = null;
		this.status = 'anon';
		writeHint(false);
	}

	async #fetch(fetcher: Fetcher): Promise<void> {
		const generation = this.#generation;
		this.hint = hasHint() ? 'user' : 'anon';

		let user: PublicUser | null = null;
		let answered = false;
		try {
			const res = await fetcher('/api/me', { cache: 'no-store' });
			if (res.ok) {
				user = (await res.json()) as PublicUser | null;
				answered = true;
			}
		} catch {
			// Network failure: fall through to signed out; the server still enforces auth.
		}

		if (generation !== this.#generation) return;
		// An unanswered request (offline, a 5xx) says nothing about the session, so the hint stays.
		if (answered) writeHint(user !== null);
		this.user = user;
		this.status = user ? 'user' : 'anon';
	}
}

export const session = new Session();
