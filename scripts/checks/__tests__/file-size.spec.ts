import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The 500-line limit on hand-written code (.claude/rules/code-standards.md, File organisation).
// OVER_LIMIT lists the files over it today, at their current length: none may grow, and one that
// drops back under the limit must leave the list.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const LIMIT = 500;
const ROOTS = ['src', 'db', 'scripts', 'e2e-tests'];
const CODE = /\.(ts|js|svelte)$/;
// Generated or vendored, not hand-written.
const SKIP = new Set(['node_modules', 'migrations', '.svelte-kit']);

const OVER_LIMIT: Record<string, number> = {
	'src/lib/media/utils/__tests__/verdict.spec.ts': 589
};

function codeFiles(dir: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
		if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue;
		const child = `${dir}/${entry.name}`;
		if (entry.isDirectory()) found.push(...codeFiles(child));
		else if (CODE.test(entry.name)) found.push(child);
	}
	return found;
}

function lineCount(file: string): number {
	return readFileSync(path.join(ROOT, file), 'utf8').trimEnd().split('\n').length;
}

describe('file size', () => {
	const lengths = new Map(ROOTS.flatMap(codeFiles).map((file) => [file, lineCount(file)]));

	it(`no hand-written file passes ${LIMIT} lines unless listed`, () => {
		const over = [...lengths]
			.filter(([file, lines]) => lines > LIMIT && !(file in OVER_LIMIT))
			.map(([file, lines]) => `${file}: ${lines}`);
		expect(over).toEqual([]);
	});

	it('no listed file grows, and none is stale', () => {
		const problems = Object.entries(OVER_LIMIT).flatMap(([file, max]) => {
			const lines = lengths.get(file);
			if (lines === undefined) return [`${file}: listed but missing`];
			if (lines > max) return [`${file}: ${lines} lines, listed at ${max}`];
			if (lines <= LIMIT) return [`${file}: back under ${LIMIT}, remove it from OVER_LIMIT`];
			return [];
		});
		expect(problems).toEqual([]);
	});
});
