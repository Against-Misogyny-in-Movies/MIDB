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
});
