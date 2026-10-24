import {
	pgTable,
	uuid,
	varchar,
	integer,
	smallint,
	text,
	timestamp,
	check,
	index
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { titles } from './titles';
import { umFlagColumns } from './columns';

/** Seeded BechdelTest.com rating, one per title. */
export const titleBechdel = pgTable(
	'title_bechdel',
	{
		titleId: uuid('title_id')
			.primaryKey()
			.references(() => titles.id, { onDelete: 'cascade' }),
		bechdelId: integer('bechdel_id').notNull(),
		rating: smallint('rating').notNull(),
		numVotes: integer('num_votes').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	() => [check('rating_range', sql`rating >= 0 AND rating <= 3`)]
);

/** The Unconsenting Media catalogue, independent of the spine. */
export const umSource = pgTable(
	'um_source',
	{
		umId: integer('um_id').primaryKey(),
		cleanName: varchar('clean_name').notNull(),
		cleanTitleKey: varchar('clean_title_key').notNull(),
		// null = unknown
		year: integer('year'),
		...umFlagColumns(),
		comment: text('comment')
	},
	(t) => [
		// getUnconsentingCandidates() looks up by cleanTitleKey
		index('um_source_clean_title_key_idx').on(t.cleanTitleKey)
	]
);

/** Binding only: a title's UM entry is read through the join, so a reseed shows immediately. */
export const titleUm = pgTable('title_um', {
	titleId: uuid('title_id')
		.primaryKey()
		.references(() => titles.id, { onDelete: 'cascade' }),
	umId: integer('um_id')
		.notNull()
		.references(() => umSource.umId),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
