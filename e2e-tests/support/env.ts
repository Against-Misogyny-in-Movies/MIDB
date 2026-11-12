import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * A value `wrangler dev` reads for the Worker: `.dev.vars`, which CI writes and a contributor
 * may create. The specs read the same file, so a spec skips exactly when the Worker lacks the value.
 */
export function devVar(name: string): string | undefined {
	let text: string;
	try {
		text = readFileSync(resolve(import.meta.dirname, '../../.dev.vars'), 'utf8');
	} catch {
		return undefined;
	}
	for (const line of text.split('\n')) {
		const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
		if (match?.[1] === name) return match[2] || undefined;
	}
	return undefined;
}

/** True when the Worker can call TMDB, which film and series pages and search need. */
export const hasTmdb = devVar('TMDB_API_TOKEN') !== undefined;

export const NO_TMDB_REASON =
	'TMDB_API_TOKEN is not set in .dev.vars, so the Worker cannot load TMDB';
