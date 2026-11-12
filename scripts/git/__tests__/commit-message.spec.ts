import { describe, expect, it } from 'vitest';
import { hookSubjects, subjectOf, subjectProblem, SUBJECT_MAX } from '../commit-message';

describe('subjectProblem', () => {
	it('accepts each type with a summary', () => {
		for (const type of ['fix', 'feat', 'refactor', 'style', 'repo'])
			expect(subjectProblem(`${type}: Series pages show the UM picker`)).toBeUndefined();
	});

	it('refuses an unknown type, a scope and a missing summary', () => {
		expect(subjectProblem('docs: Update the README')).toMatch(/does not start/);
		expect(subjectProblem('feat(db): Seed titles')).toMatch(/does not start/);
		expect(subjectProblem('fix:')).toMatch(/does not start/);
		expect(subjectProblem('fix:  ')).toMatch(/does not start/);
	});

	it('refuses a subject over the limit or with a closing period', () => {
		expect(subjectProblem(`fix: ${'a'.repeat(SUBJECT_MAX)}`)).toMatch(/characters/);
		expect(subjectProblem('fix: The verdict summary clamps to two lines.')).toMatch(/period/);
	});
});

describe('hook subjects', () => {
	it('reads the first line that is neither blank nor a comment', () => {
		expect(subjectOf('\n# Please enter the commit message\nfeat: Comment votes\n\nBody')).toBe(
			'feat: Comment votes'
		);
	});

	it('skips autosquash commits and merges in progress', () => {
		expect(hookSubjects('fixup! feat: Comment votes', false)).toEqual([]);
		expect(hookSubjects("Merge branch 'main'", true)).toEqual([]);
		expect(hookSubjects('feat: Comment votes', false)).toEqual(['feat: Comment votes']);
	});
});
