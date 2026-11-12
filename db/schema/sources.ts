import { sqliteTable, text, integer, check, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { titles } from './titles.ts';
import { createdAt, enumCheck, umFlagColumns } from './columns.ts';

/** Synced BechdelTest.com rating, one per title. */
export const titleBechdel = sqliteTable(
	'title_bechdel',
	{
		titleId: text('title_id')
			.primaryKey()
			.references(() => titles.id, { onDelete: 'cascade' }),
		bechdelId: integer('bechdel_id').notNull(),
		rating: integer('rating').notNull(),
		createdAt: createdAt()
	},
	() => [check('rating_range', sql`rating >= 0 AND rating <= 3`)]
);

/** The Unconsenting Media catalogue, independent of the spine. */
export const umSource = sqliteTable(
	'um_source',
	{
		umId: integer('um_id').primaryKey(),
		cleanName: text('clean_name').notNull(),
		cleanTitleKey: text('clean_title_key').notNull(),
		// null = unknown
		year: integer('year'),
		...umFlagColumns(),
		comment: text('comment'),
		// The feed's own `updatedAt` for the item; null for a row the feed gave no date for.
		sourceUpdatedAt: integer('source_updated_at', { mode: 'timestamp_ms' })
	},
	(t) => [
		// getUnconsentingCandidates() looks up by cleanTitleKey
		index('um_source_clean_title_key_idx').on(t.cleanTitleKey)
	]
);

/** Binding only: a title's UM entry is read through the join, so a resync shows immediately. */
export const titleUm = sqliteTable('title_um', {
	titleId: text('title_id')
		.primaryKey()
		.references(() => titles.id, { onDelete: 'cascade' }),
	umId: integer('um_id')
		.notNull()
		.references(() => umSource.umId),
	createdAt: createdAt()
});

/** `bechdel` is the last run of any kind; `bechdel_sweep` the last full sweep of every year. */
export const syncSource = ['bechdel', 'bechdel_sweep', 'um', 'popularity'] as const;

/** When each source last synced successfully, and how many rows that run changed. */
export const sourceSync = sqliteTable(
	'source_sync',
	{
		source: text('source', { enum: syncSource }).primaryKey(),
		lastSuccessAt: integer('last_success_at', { mode: 'timestamp_ms' }).notNull(),
		rowsChanged: integer('rows_changed').notNull()
	},
	(t) => [enumCheck('source_sync_source_check', t.source, syncSource)]
);
