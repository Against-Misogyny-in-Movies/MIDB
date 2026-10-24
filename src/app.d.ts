// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import type { JWTPayload } from 'jose';
import type { UserRow } from '$lib/server/data/user-queries';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Verified Hanko claims, or null when signed out. Resolved eagerly (no DB). */
			claims: JWTPayload | null;
			/** The user row, resolved lazily and memoised per request. Use the guards in `$lib/server/auth/guards`. */
			getUser(): Promise<UserRow | null>;
		}
		// interface PageData {}
		// interface Platform {}
	}
}

export {};
