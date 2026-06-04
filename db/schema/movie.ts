import { pgTable, uuid, varchar, integer, smallint, boolean, text, timestamp, serial, check, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth';

export const movies = pgTable('movies', {
	id: uuid('id').defaultRandom().primaryKey(),
	imdbId: varchar('imdb_id').unique().notNull(),
	tmdbId: integer('tmdb_id').unique(),
	title: varchar('title', { length: 255 }).notNull(),
	year: integer('year').notNull(),
	cleanTitle: varchar('clean_title', { length: 255 }).notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const movieBechdel = pgTable('movie_bechdel', {
	movieId: uuid('movie_id').primaryKey().references(() => movies.id, { onDelete: 'cascade' }),
	bechdelId: integer('bechdel_id').notNull(),
	rating: smallint('rating').notNull(),
	numVotes: integer('num_votes').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
}, () => [
	check('rating_range', sql`rating >= 0 AND rating <= 3`),
]);

export const umSource = pgTable('um_source', {
	umId: integer('um_id').primaryKey(),
	cleanName: varchar('clean_name').notNull(),
	cleanTitleKey: varchar('clean_title_key').notNull(),
	year: integer('year'),
	noRape: boolean('no_rape').notNull(),
	rapeMenDisImp: boolean('rape_men_dis_imp').notNull(),
	sexHarOnScrn: boolean('sex_har_on_scrn').notNull(),
	sexAdultTeen: boolean('sex_adult_teen').notNull(),
	childSexAbuse: boolean('child_sex_abuse').notNull(),
	incest: boolean('incest').notNull(),
	attemptedRape: boolean('attempted_rape').notNull(),
	rapeOffScrn: boolean('rape_off_scrn').notNull(),
	rapeOnScreen: boolean('rape_on_screen').notNull(),
	comment: text('comment'),
}, (t) => [
	// getUnconsentingCandidates() looks up by cleanTitleKey
	index('um_source_clean_title_key_idx').on(t.cleanTitleKey),
]);

export const movieUnconsenting = pgTable('movie_unconsenting', {
	movieId: uuid('movie_id').primaryKey().references(() => movies.id, { onDelete: 'cascade' }),
	umId: integer('um_id').notNull(),
	cleanName: varchar('clean_name').notNull(),
	itemType: varchar('item_type'),
	comment: text('comment'),
	noRape: boolean('no_rape').notNull(),
	rapeMenDisImp: boolean('rape_men_dis_imp').notNull(),
	sexHarOnScrn: boolean('sex_har_on_scrn').notNull(),
	sexAdultTeen: boolean('sex_adult_teen').notNull(),
	childSexAbuse: boolean('child_sex_abuse').notNull(),
	incest: boolean('incest').notNull(),
	attemptedRape: boolean('attempted_rape').notNull(),
	rapeOffScrn: boolean('rape_off_scrn').notNull(),
	rapeOnScreen: boolean('rape_on_screen').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const movieTriggerTags = pgTable('movie_trigger_tags', {
	id: serial('id').primaryKey(),
	movieId: uuid('movie_id').notNull().references(() => movies.id, { onDelete: 'cascade' }),
	topicId: integer('topic_id').notNull(),
	doesName: varchar('does_name').notNull(),
	yesSum: integer('yes_sum').notNull(),
	noSum: integer('no_sum').notNull(),
	comment: text('comment'),
	createdBy: text('created_by').references(() => users.id),
	createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
	uniqueIndex('movie_trigger_tags_movie_topic_idx').on(t.movieId, t.topicId),
]);
