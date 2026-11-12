import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from '../../../client.ts';

/** Statements per `db.batch` call, each call atomic. */
const BATCH_SIZE = 50;

/**
 * Runs the statements in order, in batches. A run that stops part way is finished by running
 * it again, because every sync step is a diff against what is stored.
 */
export async function runBatches(
	db: Db,
	statements: readonly BatchItem<'sqlite'>[]
): Promise<void> {
	for (let i = 0; i < statements.length; i += BATCH_SIZE) {
		const group = statements.slice(i, i + BATCH_SIZE);
		await db.batch(group as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
	}
}
