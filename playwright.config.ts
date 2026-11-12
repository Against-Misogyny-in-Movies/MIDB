import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
	webServer: {
		command: 'pnpm build && pnpm preview',
		port: 4173
	},
	testDir: 'e2e-tests',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/
};

export default config;
