import { pgTable, pgEnum, uuid, varchar, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { timestamps } from './columns';

export const titleKind = pgEnum('title_kind', ['movie', 'tv']);

/**
 * The spine every metric and community row hangs off. Natural key is `(kind, tmdb_id)`:
 * TMDB movie and TV ids share a numeric space. `imdb_id` joins seeded sources (Bechdel).
 * Either id may be null; Postgres treats NULLs as distinct, so unkeyed rows coexist.
 */
export const titles = pgTable(
	'titles',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		kind: titleKind('kind').notNull(),
		tmdbId: integer('tmdb_id'),
		imdbId: varchar('imdb_id').unique(),
		title: varchar('title', { length: 255 }).notNull(),
		cleanTitle: varchar('clean_title', { length: 255 }).notNull(),
		// null = unknown
		year: integer('year'),
		...timestamps()
	},
	(t) => [uniqueIndex('titles_kind_tmdb_idx').on(t.kind, t.tmdbId)]
);
