import { parseTarget, type ScriptTarget } from '../../lib/args.ts';

export interface SyncArgs {
	target: ScriptTarget;
	/** Read the test fixtures instead of the live sources. Never with `--remote`. */
	fixtures: boolean;
	/** Sweep every Bechdel Test year, not just the recent ones. The fixtures always sweep: they hold a few pages. */
	full: boolean;
}

export function parseSyncArgs(argv: readonly string[]): SyncArgs {
	const fixtures = argv.includes('--fixtures');
	const target = parseTarget(argv);
	if (fixtures && target === 'remote') {
		throw new Error('--fixtures writes test data; it cannot be used with --remote.');
	}
	return { target, fixtures, full: fixtures || argv.includes('--full') };
}
