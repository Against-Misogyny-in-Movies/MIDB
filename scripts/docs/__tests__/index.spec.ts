import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	buildGraph,
	groups,
	headingsOf,
	INDEX_PATH,
	renderIndex,
	resolveSection,
	ROOT
} from '../index';

describe('docs index', () => {
	it('is current (run `pnpm docs:index` after a doc or heading change)', () => {
		const graph = buildGraph();
		expect(readFileSync(path.join(ROOT, INDEX_PATH), 'utf8')).toBe(renderIndex(graph));
	});

	it('every doc citation in code and live docs names a heading', () => {
		const unresolved = buildGraph().unresolved.map((c) => `${c.from} → ${c.doc}, ${c.section}`);
		expect(unresolved).toEqual([]);
	});
});

describe('renderIndex', () => {
	it('leaves a group with no files out, and stays Prettier-stable', () => {
		const graph = buildGraph();
		const list = groups().map((group) =>
			group.title === 'Live plans' ? { ...group, files: [] } : group
		);
		const out = renderIndex(graph, list);
		expect(out).not.toContain('## Live plans');
		expect(out).not.toMatch(/\n\n\n/);
	});
});

describe('resolveSection', () => {
	const headings = headingsOf(
		'# Doc\n\n## Caching policy\n\ntext\n\n## Tables\n\n### Table rows\n'
	);

	it('matches exact, prefix and whole-word substrings', () => {
		expect(resolveSection(headings, 'Caching policy')?.start).toBe(3);
		expect(resolveSection(headings, 'Caching')?.start).toBe(3);
		expect(resolveSection(headings, 'rows')?.start).toBe(9);
	});

	it('does not match part of a word, and splits "and"', () => {
		expect(resolveSection(headings, 'Table')?.start).toBe(9);
		expect(resolveSection(headings, 'Missing and Tables')?.start).toBe(7);
		expect(resolveSection(headings, 'Missing')).toBeNull();
	});
});
