import { describe, it, expect, vi, beforeEach } from 'vitest';

const testEnv = vi.hoisted((): Record<string, string | undefined> => ({}));
vi.mock('#lib/server/env.ts', () => ({ env: testEnv }));

const { configuredProviders, providerCredentials } = await import('../providers.ts');

beforeEach(() => {
	for (const key of Object.keys(testEnv)) delete testEnv[key];
});

describe('configuredProviders', () => {
	it('shows no provider when no credentials are set', () => {
		expect(configuredProviders()).toEqual({ google: false, discord: false });
	});

	it('shows a provider only when its id and secret are both set', () => {
		testEnv.GOOGLE_CLIENT_ID = 'id';
		testEnv.DISCORD_CLIENT_ID = 'id';
		testEnv.DISCORD_CLIENT_SECRET = 'secret';
		expect(configuredProviders()).toEqual({ google: false, discord: true });
	});

	it('treats empty strings (a blank .env line) as unset', () => {
		testEnv.GOOGLE_CLIENT_ID = '';
		testEnv.GOOGLE_CLIENT_SECRET = '';
		expect(providerCredentials().google).toBeUndefined();
	});

	it('returns the flags without the credentials', () => {
		testEnv.GOOGLE_CLIENT_ID = 'id';
		testEnv.GOOGLE_CLIENT_SECRET = 'secret';
		expect(JSON.stringify(configuredProviders())).not.toContain('secret');
	});
});
