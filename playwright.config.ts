import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'bun run build && bun run preview',
		port: 4173
	},
	testDir: 'e2e-tests',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/
};

export default config;
