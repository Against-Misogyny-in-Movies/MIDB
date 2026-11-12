// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import type { UserRow } from '#lib/server/data/user-queries.ts';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** The user row, resolved lazily and memoised per request. Use the guards in `#lib/server/auth/guards.ts`. */
			getUser(): Promise<UserRow | null>;
		}
		// interface PageData {}
		// interface Platform {}
	}
}

export {};
