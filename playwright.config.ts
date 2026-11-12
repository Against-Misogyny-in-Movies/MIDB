import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'pnpm preview',
		port: 4173
	},
	testDir: 'e2e-tests',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/,
	// One worker: the specs share one local D1 and one Worker, and the auth and comment rate
	// limits count per client address.
	workers: 1
};

export default config;
