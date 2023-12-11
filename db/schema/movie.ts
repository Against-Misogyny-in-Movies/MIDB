import { integer, pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const movies = pgTable('movies', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 255 }),
    tmdbID: integer('tmdb_id').unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
});
