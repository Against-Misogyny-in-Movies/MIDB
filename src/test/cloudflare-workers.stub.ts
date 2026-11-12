// Vitest's stand-in for the `cloudflare:workers` module (aliased in vite.config.ts), which only
// exists inside the Workers runtime. `env` is mutable so a spec sets the secrets and bindings it
// needs, `waitUntil` does nothing, and `cache.purge` records its calls for the spec to inspect.

export interface PurgeOptions {
	tags?: string[];
	pathPrefixes?: string[];
	purgeEverything?: boolean;
}

export const env: Record<string, unknown> = {};

export const purgeCalls: PurgeOptions[] = [];

export const cache = {
	purge(options: PurgeOptions): Promise<{ success: boolean; errors: unknown[] }> {
		purgeCalls.push(options);
		return Promise.resolve({ success: true, errors: [] });
	}
};

export function waitUntil(_promise: Promise<unknown>): void {}

/** Empties `env` and the recorded purges. Specs call it in `beforeEach`. */
export function resetCloudflareStub(): void {
	for (const key of Object.keys(env)) delete env[key];
	purgeCalls.length = 0;
}
