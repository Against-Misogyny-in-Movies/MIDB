import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'pnpm preview',
		port: 4173,
		// The command builds the site before it serves.
		timeout: 300_000
	},
	testDir: 'e2e-tests',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/,
	// One worker: the specs share one local D1 and one Worker, and the auth rate limit (`RL_AUTH`)
	// counts per client address; the comment limits count per user.
	workers: 1
};

export default config;
