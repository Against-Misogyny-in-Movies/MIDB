import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from '#lib/server/http/security-headers.ts';

/** The `Name: value` lines under one path of the `_headers` file, names lowercased. */
function rulesFor(file: string, path: string): Record<string, string> {
	const lines = file.split('\n');
	const start = lines.findIndex((line) => line === path);
	if (start === -1) throw new Error(`no rule for ${path}`);
	const rules: Record<string, string> = {};
	for (const line of lines.slice(start + 1)) {
		if (!line.startsWith('  ')) break;
		const [name, ...value] = line.trim().split(': ');
		rules[name.toLowerCase()] = value.join(': ');
	}
	return rules;
}

const file = readFileSync(resolve(process.cwd(), '_headers'), 'utf-8');

describe('the _headers file for Workers Assets', () => {
	it('gives every static file the security headers the request hook sets', () => {
		expect(rulesFor(file, '/*')).toEqual(SECURITY_HEADERS);
	});

	it('caches the pre-paint theme script for an hour', () => {
		expect(rulesFor(file, '/theme-init.js')).toEqual({ 'cache-control': 'public, max-age=3600' });
	});
});
