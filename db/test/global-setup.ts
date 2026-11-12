import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { TEST_STATE_PATH } from './state.ts';

/**
 * Vitest globalSetup for the `db` project: wipe the local D1 test state and apply the
 * migrations to it with wrangler, so every run also proves the baseline applies from zero.
 * The persisted state is Miniflare's own; `setup.ts` opens it for each spec file.
 */
export default function setup() {
	rmSync(TEST_STATE_PATH, { recursive: true, force: true });
	try {
		execFileSync(
			'pnpm',
			[
				'exec',
				'wrangler',
				'd1',
				'migrations',
				'apply',
				'DB',
				'--local',
				'--persist-to',
				TEST_STATE_PATH
			],
			{ stdio: 'pipe', encoding: 'utf8' }
		);
	} catch (e) {
		const { stdout, stderr } = e as { stdout?: string; stderr?: string };
		throw new Error(
			`Applying the migrations to the local D1 failed.\n${stdout ?? ''}${stderr ?? ''}`,
			{
				cause: e
			}
		);
	}
}
