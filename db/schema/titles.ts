import {
	sqliteTable,
	text,
	integer,
	real,
	index,
	uniqueIndex,
	check
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { enumCheck, timestamps } from './columns.ts';

export const titleKind = ['movie', 'tv'] as const;

/**
 * The spine every metric and community row hangs off. Natural key is `(kind, tmdb_id)`:
 * TMDB movie and TV ids share a numeric space. `imdb_id` joins synced sources (Bechdel).
 * Either id may be null; SQLite treats NULLs as distinct in a unique index, so unkeyed rows
 * coexist. `popularity` is TMDB's daily popularity score, null until the sync has seen the title.
 */
export const titles = sqliteTable(
	'titles',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		kind: text('kind', { enum: titleKind }).notNull(),
		tmdbId: integer('tmdb_id'),
		imdbId: text('imdb_id').unique(),
		title: text('title', { length: 255 }).notNull(),
		cleanTitle: text('clean_title', { length: 255 }).notNull(),
		// null = unknown
		year: integer('year'),
		popularity: real('popularity'),
		popularityAt: integer('popularity_at', { mode: 'timestamp_ms' }),
		...timestamps()
	},
	(t) => [
		uniqueIndex('titles_kind_tmdb_idx').on(t.kind, t.tmdbId),
		index('titles_popularity_idx').on(t.popularity),
		enumCheck('titles_kind_check', t.kind, titleKind),
		check('titles_title_length', sql`length(${t.title}) <= 255`),
		check('titles_clean_title_length', sql`length(${t.cleanTitle}) <= 255`)
	]
);
