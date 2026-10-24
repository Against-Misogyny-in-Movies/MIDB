// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import type { UserRow } from '$lib/server/data/user-queries';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: UserRow | null;
		}
		interface PageData {
			user?: UserRow | null;
		}
		// interface Platform {}
	}
}

export {};
