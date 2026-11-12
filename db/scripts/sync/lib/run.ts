import { openScriptDb } from '../../lib/db.ts';
import { describeError } from '../../lib/describe-error.ts';
import type { Db } from '../../../client.ts';
import { parseSyncArgs, type SyncArgs } from './args.ts';
import { fixtureSources, liveSources, type SyncSources } from './sources.ts';

/**
 * Runs a sync entry point: parses the flags, opens the database, closes it, and turns a
 * failure into its message, the causes behind it and a non-zero exit, so a scheduled job fails visibly.
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
		console.error(describeError(error));
		process.exitCode = 1;
	} finally {
		await close?.();
	}
}
