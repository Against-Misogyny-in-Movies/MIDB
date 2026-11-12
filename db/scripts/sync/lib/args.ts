import { openScriptDb } from '../../lib/db.ts';
import { parseTarget, type ScriptTarget } from '../../lib/args.ts';
import type { Db } from '../../../client.ts';
import { fixtureSources, liveSources, type SyncSources } from './sources.ts';

export interface SyncArgs {
	target: ScriptTarget;
	/** Read the test fixtures instead of the live sources. */
	fixtures: boolean;
	/** Sweep every Bechdel Test year, not just the recent ones. The fixtures always sweep: they hold a few pages. */
	full: boolean;
}

export function parseSyncArgs(argv: readonly string[]): SyncArgs {
	const fixtures = argv.includes('--fixtures');
	return { target: parseTarget(argv), fixtures, full: fixtures || argv.includes('--full') };
}

/**
 * Runs a sync entry point: parses the flags, opens the database, closes it, and turns a
 * failure into a message and a non-zero exit, so a scheduled job fails visibly.
 */
export async function runSync(
	argv: readonly string[],
	job: (db: Db, sources: SyncSources, args: SyncArgs) => Promise<void>
): Promise<void> {
	let close: (() => Promise<void>) | undefined;
	try {
		const args = parseSyncArgs(argv);
		const opened = await openScriptDb(args.target);
		close = opened.close;
		await job(opened.db, args.fixtures ? fixtureSources() : liveSources(), args);
	} catch (error) {
		console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
		process.exitCode = 1;
	} finally {
		await close?.();
	}
}
