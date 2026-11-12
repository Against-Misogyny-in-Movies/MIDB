import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The docs index (docs/INDEX.md): every file an agent reads, its size, the heading tree of the long
// ones with line ranges, and which code cites each section, so an agent reads one section instead of
// a whole file (.claude/rules/docs-standards.md, The index).
// Usage: bun run docs:index rewrites docs/INDEX.md; bun run docs:section <file> "<heading>" prints one section.

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const INDEX_PATH = 'docs/INDEX.md';

// A file at least this long gets its heading tree in the index; a shorter one is read whole.
const SECTIONED_BYTES = 12_000;
// Code whose comments cite a doc section.
const CITING_ROOTS = ['src', 'db', 'scripts', 'e2e-tests'];
const CODE_FILE = /\.(ts|js|svelte|css)$/;

type Group = { title: string; note: string; files: string[] };

export type Heading = { level: number; text: string; start: number; end: number; bytes: number };

export type Citation = { from: string; doc: string; section: string };

function listFiles(dir: string, keep: (name: string) => boolean): string[] {
	const full = path.join(ROOT, dir);
	if (!existsSync(full)) return [];
	if (statSync(full).isFile()) return keep(full) ? [dir] : [];
	const found: string[] = [];
	const entries = readdirSync(full, { withFileTypes: true }).sort((a, b) =>
		a.name.localeCompare(b.name)
	);
	for (const entry of entries) {
		if (entry.name === 'node_modules' || entry.name === 'migrations' || entry.name.startsWith('.'))
			continue;
		const child = path.join(dir, entry.name);
		if (entry.isDirectory()) found.push(...listFiles(child, keep));
		else if (keep(entry.name)) found.push(child.split(path.sep).join('/'));
	}
	return found;
}

function markdownIn(dir: string, skip: (name: string) => boolean = () => false): string[] {
	const full = path.join(ROOT, dir);
	if (!existsSync(full)) return [];
	return readdirSync(full)
		.filter((name) => name.endsWith('.md') && !skip(name))
		.sort()
		.map((name) => `${dir}/${name}`);
}

export function groups(): Group[] {
	return [
		{
			title: 'Every session',
			note: 'Read whole.',
			files: ['AGENTS.md', ...markdownIn('.claude/rules')]
		},
		{
			title: 'Agents',
			note: 'Each agent reads its own file.',
			files: markdownIn('.claude/agents')
		},
		{
			title: 'Product, code and design',
			note: 'Read the sections your task touches.',
			files: ['README.md', 'PRODUCT.md', 'DESIGN.md', 'docs/architecture.md']
		},
		{
			title: 'Phases',
			note: 'STATUS.md, then the live plan section for the active phase.',
			files: ['docs/phases/STATUS.md']
		},
		{
			title: 'Live plans',
			note: 'Read when a task names the plan.',
			files: markdownIn('docs/plans')
		},
		{
			title: 'Policies',
			note: 'Read before a change that touches what they describe.',
			files: [
				'CONTRIBUTING.md',
				'SECURITY.md',
				'PRIVACY.md',
				'ACCESSIBILITY.md',
				'THIRD_PARTY_NOTICES.md'
			].filter((file) => existsSync(path.join(ROOT, file)))
		}
	];
}

export function headingsOf(text: string): Heading[] {
	const lines = text.split('\n');
	const found: Heading[] = [];
	let fenced = false;
	lines.forEach((line, index) => {
		if (line.startsWith('```')) fenced = !fenced;
		const match = fenced ? null : /^(#{1,4}) (.+)$/.exec(line);
		if (match)
			found.push({
				level: match[1]!.length,
				text: match[2]!.trim(),
				start: index + 1,
				end: lines.length,
				bytes: 0
			});
	});
	for (const [i, heading] of found.entries()) {
		const next = found.slice(i + 1).find((other) => other.level <= heading.level);
		heading.end = next ? next.start - 1 : lines.length;
		heading.bytes = Buffer.byteLength(lines.slice(heading.start - 1, heading.end).join('\n'));
	}
	return found;
}

function normalize(text: string): string {
	return text.toLowerCase().replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
}

// The heading a cited section name means: an exact match, else the first heading that starts with it,
// else one that contains it, whole words only. "Components and Database" names two: the first part
// that resolves wins. Null when none does.
export function resolveSection(headings: readonly Heading[], section: string): Heading | null {
	const name = normalize(section);
	if (name.length === 0) return null;
	const texts = headings.map((heading) => normalize(heading.text));
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const prefix = new RegExp(`^${escaped}(?![\\p{L}\\p{N}])`, 'u');
	const inside = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u');
	const at = [
		texts.findIndex((text) => text === name),
		texts.findIndex((text) => prefix.test(text)),
		texts.findIndex((text) => inside.test(text))
	].find((i) => i >= 0);
	if (at !== undefined) return headings[at]!;
	const parts = section.split(/ and /);
	return parts.length > 1
		? (parts.map((part) => resolveSection(headings, part)).find((heading) => heading !== null) ??
				null)
		: null;
}

// "docs/architecture.md, Caching policy" or "code-standards.md (Checking a change)": the doc and the
// first section name after it. Only a capitalised section name counts, so prose such as
// "docs/architecture.md, which" is not a citation.
const CITATION =
	/((?:[A-Za-z0-9-]+\/)*[A-Za-z0-9_-]+\.md)`?(?:, |,\n\s*(?:\/\/|\*)\s*| \()([A-Z][^;:,()\n.`"]*)/g;

export function citationsIn(
	file: string,
	text: string,
	docs: ReadonlyMap<string, string>
): Citation[] {
	const found: Citation[] = [];
	for (const match of text.matchAll(CITATION)) {
		// "CONTRIBUTING.md, SECURITY.md" lists files: the second name is a doc, not a section.
		if (text.startsWith('.md', match.index + match[0].length)) continue;
		const doc = docs.get(match[1]!) ?? docs.get(path.basename(match[1]!));
		const section = match[2]!.replace(/\*\*/g, '').trim();
		if (doc && !/^(phase|user|line|part|step|pr) /i.test(section))
			found.push({ from: file, doc, section });
	}
	return found;
}

type Indexed = { file: string; bytes: number; title: string; headings: Heading[] };

function load(file: string): Indexed {
	const text = readFileSync(path.join(ROOT, file), 'utf8');
	const headings = headingsOf(text);
	// An agent file's title is its description's first sentence.
	const title =
		/^description: (.+)$/m.exec(text)?.[1] ??
		headings.find((heading) => heading.level === 1)?.text ??
		'';
	return {
		file,
		bytes: Buffer.byteLength(text),
		title: title.split(/(?<=\.) /)[0]!.replace(/\.$/, ''),
		headings
	};
}

function tokens(bytes: number): string {
	const count = bytes / 4;
	return count >= 1000
		? `${(count / 1000).toFixed(1)}K`
		: `${Math.max(10, Math.round(count / 10) * 10)}`;
}

export type Graph = {
	indexed: Indexed[];
	citations: Citation[];
	unresolved: Citation[];
	citers: Map<string, Set<string>>;
};

export function buildGraph(): Graph {
	const indexed = groups()
		.flatMap((group) => group.files)
		.map(load);
	const docs = new Map<string, string>();
	for (const doc of indexed) {
		docs.set(doc.file, doc.file);
		docs.set(doc.file.replace(/^docs\//, ''), doc.file);
		if (!docs.has(path.basename(doc.file))) docs.set(path.basename(doc.file), doc.file);
	}
	const code = CITING_ROOTS.flatMap((root) => listFiles(root, (name) => CODE_FILE.test(name)));
	const live = groups().flatMap((group) => group.files);
	const citations = [...code, ...live].flatMap((file) =>
		citationsIn(file, readFileSync(path.join(ROOT, file), 'utf8'), docs)
	);
	const byFile = new Map(indexed.map((doc) => [doc.file, doc]));
	const citers = new Map<string, Set<string>>();
	const unresolved: Citation[] = [];
	for (const citation of citations) {
		const heading = resolveSection(byFile.get(citation.doc)!.headings, citation.section);
		if (!heading) {
			unresolved.push(citation);
			continue;
		}
		const key = `${citation.doc}#${heading.start}`;
		citers.set(key, (citers.get(key) ?? new Set()).add(citation.from));
	}
	return { indexed, citations, unresolved, citers };
}

// Where the citing code lives, by directory: src/lib, src/routes, db/scripts.
function area(file: string): string {
	const parts = file.split('/');
	return parts.length <= 2 ? parts[0]! : parts.slice(0, 2).join('/');
}

export function renderIndex(graph: Graph = buildGraph()): string {
	const byFile = new Map(graph.indexed.map((doc) => [doc.file, doc]));
	const out: string[] = [
		'# Docs index',
		'',
		'Generated by `bun run docs:index` from the files below and the doc citations in code comments; a test fails when it is stale. Do not edit it by hand.',
		'',
		'Read a section, not a file: `bun run docs:section <file> "<heading>"` prints one section with its subsections (the file may be a basename such as `architecture`). The line range works with an offset and limit too. ~tok is bytes / 4. `← n` is how many code files and docs cite the section; the last part of this file lists the code citations by area.',
		''
	];
	for (const group of groups()) {
		out.push(`## ${group.title}`, '', group.note, '');
		for (const file of group.files) {
			const doc = byFile.get(file)!;
			const title = doc.title ? ` — ${doc.title}` : '';
			out.push(`- \`${file}\`${title} (~${tokens(doc.bytes)} tok)`);
			if (doc.bytes < SECTIONED_BYTES) continue;
			for (const heading of doc.headings) {
				if (heading.level === 1 || heading.level > 3) continue;
				const cited = graph.citers.get(`${file}#${heading.start}`)?.size ?? 0;
				const indent = '  '.repeat(heading.level - 1);
				out.push(
					`${indent}- ${heading.start}–${heading.end} ${heading.text} (~${tokens(heading.bytes)})${cited > 0 ? ` ← ${cited}` : ''}`
				);
			}
		}
		out.push('');
	}
	out.push(
		'## Code to docs',
		'',
		"The sections each area's comments cite, most cited first. Read these before changing code there.",
		''
	);
	const areas = new Map<string, Map<string, number>>();
	for (const [key, files] of graph.citers) {
		const [doc, start] = key.split('#') as [string, string];
		const heading = byFile.get(doc)!.headings.find((item) => item.start === Number(start))!;
		const label = `${doc}, ${heading.text}`;
		for (const file of files) {
			if (!CODE_FILE.test(file)) continue;
			const counts = areas.get(area(file)) ?? new Map<string, number>();
			counts.set(label, (counts.get(label) ?? 0) + 1);
			areas.set(area(file), counts);
		}
	}
	if (areas.size === 0) out.push('No code comment cites a doc section yet.');
	for (const name of [...areas.keys()].sort()) {
		const ranked = [...areas.get(name)!].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
		out.push(`- \`${name}\`: ${ranked.map(([label, count]) => `${label} (${count})`).join('; ')}`);
	}
	out.push('');
	return out.join('\n');
}

// The lines of one section: the file by path or basename, the heading by exact text, prefix or substring.
export function sectionText(fileArg: string, headingArg: string): string {
	const all = groups().flatMap((group) => group.files);
	const wanted = fileArg.replace(/\.md$/, '').toLowerCase();
	const file = all.find(
		(item) =>
			item === fileArg ||
			item.replace(/\.md$/, '').toLowerCase() === wanted ||
			path.basename(item).replace(/\.md$/, '').toLowerCase() === wanted
	);
	if (!file) throw new Error(`no indexed doc named ${fileArg}; see ${INDEX_PATH}`);
	const text = readFileSync(path.join(ROOT, file), 'utf8');
	const headings = headingsOf(text);
	const heading = resolveSection(headings, headingArg);
	if (!heading)
		throw new Error(
			`no heading in ${file} matches "${headingArg}"; its headings: ${headings.map((item) => item.text).join(' | ')}`
		);
	return `${file}:${heading.start}-${heading.end}\n${text
		.split('\n')
		.slice(heading.start - 1, heading.end)
		.join('\n')}\n`;
}

function main(): void {
	const [command, fileArg, ...rest] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
	if (command === 'section') {
		if (!fileArg || rest.length === 0)
			throw new Error('usage: bun run docs:section <file> "<heading>"');
		process.stdout.write(sectionText(fileArg, rest.join(' ')));
		return;
	}
	const graph = buildGraph();
	writeFileSync(path.join(ROOT, INDEX_PATH), renderIndex(graph));
	for (const citation of graph.unresolved)
		console.warn(`${citation.from}: no heading in ${citation.doc} matches "${citation.section}"`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
