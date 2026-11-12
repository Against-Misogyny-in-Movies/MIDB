import { describe, it, expect, beforeEach } from 'vitest';
import { cache, env as workersEnv } from 'cloudflare:workers';
import { env } from '#lib/server/env.ts';
import { purgeCalls, resetCloudflareStub } from '#test/cloudflare-workers.stub.ts';

beforeEach(resetCloudflareStub);

describe('env accessor', () => {
	it('reads what the Worker env holds, and an unset secret is undefined', () => {
		expect(env.ANTHROPIC_API_KEY).toBeUndefined();
		env.ANTHROPIC_API_KEY = 'sk-test';
		expect(env.ANTHROPIC_API_KEY).toBe('sk-test');
	});

	it('is the Worker env itself, so a binding set later is seen', () => {
		expect(env).toBe(workersEnv);
		const binding = { limit: () => Promise.resolve({ success: true }) };
		env.RL_SEARCH = binding;
		expect(env.RL_SEARCH).toBe(binding);
	});
});

describe('cloudflare:workers stub', () => {
	it('records cache.purge calls and clears them on reset', async () => {
		await expect(cache.purge({ tags: ['comments:movie:603'] })).resolves.toEqual({
			success: true,
			errors: []
		});
		expect(purgeCalls).toEqual([{ tags: ['comments:movie:603'] }]);
		resetCloudflareStub();
		expect(purgeCalls).toEqual([]);
	});
});
