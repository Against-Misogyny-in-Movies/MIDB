import { mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { isMain } from '../is-main';

const argv = process.argv;

afterEach(() => {
	process.argv = argv;
});

describe('isMain', () => {
	it('is true when the module is the script node was started with', () => {
		process.argv = ['node', 'scripts/git/commit-message.ts'];
		expect(isMain(pathToFileURL(path.resolve('scripts/git/commit-message.ts')).href)).toBe(true);
	});

	it('is false for an imported module', () => {
		process.argv = ['node', 'scripts/docs/index.ts'];
		expect(isMain(pathToFileURL(path.resolve('scripts/git/commit-message.ts')).href)).toBe(false);
	});

	it('is false when there is no entry script', () => {
		process.argv = ['node'];
		expect(isMain(pathToFileURL(path.resolve('scripts/git/commit-message.ts')).href)).toBe(false);
	});

	it('is true when the entry path is a symlink to the module', () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'is-main-'));
		try {
			const real = path.resolve('scripts/git/commit-message.ts');
			const link = path.join(dir, 'link.ts');
			symlinkSync(real, link);
			process.argv = ['node', link];
			expect(isMain(pathToFileURL(realpathSync(real)).href)).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
