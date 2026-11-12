import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Checks commit subjects against .claude/rules/commit-standards.md, Subject line: "<type>: <summary>",
// one of the types below, at most 72 characters, no closing period.
// Usage: bun run commit:check "<subject>"... checks the subjects given; --range <base>..<head> checks
// every non-merge commit in the range (CI checks a pull request's commits and its title, which becomes
// the squash commit's subject); --file <path> checks a message file (the commit-msg hook,
// .githooks/commit-msg); --install points this checkout's git at .githooks (`bun install` runs it
// through `prepare`; outside a git checkout it does nothing).

export const COMMIT_TYPES = ['fix', 'feat', 'refactor', 'style', 'repo'] as const;
export const SUBJECT_MAX = 72;

const SUBJECT = new RegExp(`^(${COMMIT_TYPES.join('|')}): \\S`);
// Subjects git writes for `commit --fixup`, `--squash` and `--fixup=amend:`; a rebase folds them away.
const AUTOSQUASH = /^(fixup|squash|amend)! /;

/** What is wrong with a commit subject, or undefined when it follows the standard. */
export function subjectProblem(subject: string): string | undefined {
	if (!SUBJECT.test(subject))
		return `"${subject}" does not start with "<type>: " (types: ${COMMIT_TYPES.join(', ')})`;
	if (subject.length > SUBJECT_MAX)
		return `"${subject}" is ${subject.length} characters; the limit is ${SUBJECT_MAX}`;
	if (subject.endsWith('.')) return `"${subject}" ends with a period`;
	return undefined;
}

/** The subject of a message file as git stores it: the first line that is neither blank nor a "#" comment. */
export function subjectOf(message: string): string {
	return (
		message
			.split('\n')
			.find((line) => line.trim() !== '' && !line.startsWith('#'))
			?.trim() ?? ''
	);
}

/**
 * The subjects the hook checks in a message file: none for an autosquash commit, or for a merge
 * commit git is writing (MERGE_HEAD exists; such a merge stays on a branch, which lands on main squashed).
 */
export function hookSubjects(message: string, merging: boolean): string[] {
	const subject = subjectOf(message);
	return merging || AUTOSQUASH.test(subject) ? [] : [subject];
}

function git(args: string[]): string {
	return execFileSync('git', args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore']
	}).trim();
}

function isMerging(): boolean {
	try {
		git(['rev-parse', '--verify', '--quiet', 'MERGE_HEAD']);
		return true;
	} catch {
		return false;
	}
}

function install(): void {
	try {
		git(['rev-parse', '--git-dir']);
	} catch {
		return; // not a git checkout (an installed tarball): nothing to hook
	}
	git(['config', 'core.hooksPath', '.githooks']);
}

function flag(args: string[], name: string): string | undefined {
	const at = args.indexOf(name);
	if (at < 0) return undefined;
	const value = args[at + 1];
	if (!value) throw new Error(`${name} needs a value`);
	return value;
}

function subjectsToCheck(args: string[]): string[] {
	const file = flag(args, '--file');
	if (file) return hookSubjects(readFileSync(file, 'utf8'), isMerging());
	const range = flag(args, '--range');
	if (range)
		return git(['log', '--no-merges', '--format=%s', range])
			.split('\n')
			.filter((line) => line !== '');
	const given = args.filter((arg) => !arg.startsWith('--'));
	if (given.length === 0)
		throw new Error(
			'usage: bun run commit:check "<subject>"... | --range <base>..<head> | --file <path>'
		);
	return given;
}

function main(): void {
	const args = process.argv.slice(2);
	if (args.includes('--install')) return install();
	const checked = subjectsToCheck(args);
	const problems = checked.map(subjectProblem).filter((problem) => problem !== undefined);
	if (problems.length === 0) return;
	for (const problem of problems) console.error(problem);
	console.error(
		`${problems.length} of ${checked.length} subjects break .claude/rules/commit-standards.md (Subject line)`
	);
	process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
