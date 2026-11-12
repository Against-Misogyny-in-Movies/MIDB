// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { env, resetCloudflareStub } from '#test/cloudflare-workers.stub.ts';
import { getAnthropic } from '../anthropic.ts';

beforeEach(resetCloudflareStub);

describe('getAnthropic', () => {
	it('is null without a key', () => {
		expect(getAnthropic()).toBeNull();
		env.ANTHROPIC_API_KEY = '';
		expect(getAnthropic()).toBeNull();
	});

	it('builds a client from the key at call time, with the 8 s timeout and one retry', () => {
		env.ANTHROPIC_API_KEY = 'sk-test';
		const client = getAnthropic();
		expect(client?.apiKey).toBe('sk-test');
		expect(client?.timeout).toBe(8000);
		expect(client?.maxRetries).toBe(1);
	});
});
