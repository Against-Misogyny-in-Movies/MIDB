import { describe, expect, it } from 'vitest';
import { publicVarProblems, stripJsonComments, wranglerVars } from '../public-vars.ts';

const CONFIG = `{
	// production
	"vars": { "PUBLIC_ORIGIN": "https://a.example", "URL": "https://x/*not a comment*/" },
	/* preview */
	"env": { "preview": { "vars": { "PUBLIC_ORIGIN": "https://b.example" } } }
}`;

describe('wranglerVars', () => {
	it('reads each target and keeps comment markers inside strings', () => {
		expect(wranglerVars(CONFIG, 'production')).toEqual({
			PUBLIC_ORIGIN: 'https://a.example',
			URL: 'https://x/*not a comment*/'
		});
		expect(wranglerVars(CONFIG, 'preview')).toEqual({ PUBLIC_ORIGIN: 'https://b.example' });
	});

	it('throws when a target has no vars', () => {
		expect(() => wranglerVars('{ "vars": {} }', 'preview')).toThrow('no vars for preview');
	});
});

describe('stripJsonComments', () => {
	it('handles an escaped quote in a string', () => {
		expect(JSON.parse(stripJsonComments('{ "a": "q\\" // x" } // end'))).toEqual({ a: 'q" // x' });
	});
});

describe('publicVarProblems', () => {
	const vars = { PUBLIC_ORIGIN: 'https://a.example', MODERATION_MODEL: 'm' };

	it('passes when every PUBLIC_ value matches, and ignores the others', () => {
		expect(publicVarProblems(vars, { PUBLIC_ORIGIN: 'https://a.example' })).toEqual([]);
	});

	it('names a value that differs or is missing', () => {
		expect(publicVarProblems(vars, { PUBLIC_ORIGIN: 'https://b.example' })).toHaveLength(1);
		expect(publicVarProblems(vars, {})).toHaveLength(1);
	});
});
