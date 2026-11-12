import { readFileSync } from 'node:fs';
import { isMain } from '../lib/is-main.ts';

// Reads the `vars` of one target in `wrangler.jsonc` for the workflows. The `PUBLIC_*` values are
// inlined into the build (`src/env.ts`), so the build's environment and the Worker's `vars` must
// agree (docs/architecture.md, Deploy).
// Usage: node scripts/ci/public-vars.ts <production|preview> export <NAME>...   prints NAME=value lines
//        (for `>> "$GITHUB_ENV"`), so the build takes those values from `wrangler.jsonc`;
//        node scripts/ci/public-vars.ts <production|preview> check   fails when a `PUBLIC_*` value in
//        the environment differs from the target's `vars`.

export type Target = 'production' | 'preview';

/** The text without its line and block comments; a comment marker inside a string stays. */
export function stripJsonComments(text: string): string {
	let out = '';
	let i = 0;
	while (i < text.length) {
		const ch = text[i];
		if (ch === '"') {
			let j = i + 1;
			while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
			out += text.slice(i, j + 1);
			i = j + 1;
		} else if (ch === '/' && text[i + 1] === '/') {
			while (i < text.length && text[i] !== '\n') i++;
		} else if (ch === '/' && text[i + 1] === '*') {
			const end = text.indexOf('*/', i + 2);
			i = end === -1 ? text.length : end + 2;
		} else {
			out += ch;
			i++;
		}
	}
	return out;
}

interface WranglerConfig {
	vars?: Record<string, string>;
	env?: Record<string, { vars?: Record<string, string> }>;
}

/** The string `vars` of a target: the top-level ones for production, `env.preview.vars` for preview. */
export function wranglerVars(configText: string, target: Target): Record<string, string> {
	const config = JSON.parse(stripJsonComments(configText)) as WranglerConfig;
	const vars = target === 'production' ? config.vars : config.env?.[target]?.vars;
	if (!vars) throw new Error(`wrangler.jsonc has no vars for ${target}`);
	return vars;
}

/** One line per `PUBLIC_*` value of `vars` that is missing from `env` or differs from it. */
export function publicVarProblems(
	vars: Record<string, string>,
	env: Record<string, string | undefined>
): string[] {
	return Object.keys(vars)
		.filter((name) => name.startsWith('PUBLIC_') && env[name] !== vars[name])
		.map(
			(name) =>
				`${name} is "${env[name] ?? ''}" in the build but "${vars[name]}" in wrangler.jsonc; make them equal`
		);
}

function parseTarget(value: string | undefined): Target {
	if (value === 'production' || value === 'preview') return value;
	throw new Error('Usage: public-vars.ts <production|preview> <export NAME...|check>');
}

if (isMain(import.meta.url)) {
	try {
		const [targetArg, mode, ...names] = process.argv.slice(2);
		const target = parseTarget(targetArg);
		const vars = wranglerVars(readFileSync('wrangler.jsonc', 'utf8'), target);
		if (mode === 'export') {
			for (const name of names) {
				const value = vars[name];
				if (value === undefined) throw new Error(`wrangler.jsonc has no ${name} for ${target}`);
				console.log(`${name}=${value}`);
			}
		} else if (mode === 'check') {
			const problems = publicVarProblems(vars, process.env);
			if (problems.length > 0) {
				console.error(problems.join('\n'));
				process.exitCode = 1;
			}
		} else {
			parseTarget(undefined);
		}
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}
