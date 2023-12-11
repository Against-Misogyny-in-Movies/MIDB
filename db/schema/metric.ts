import { users } from './auth';
import { movies } from './movie';
import { pgTable, uuid, varchar, integer, boolean, timestamp, serial, text, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';


export const metrics = pgTable('metrics', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }),
    slug: varchar('slug', { length: 100 }).unique(),
    shortDescription: varchar('short_description', { length: 500 }),
    description: varchar('description', { length: 1000 }),
    realtedOptions: boolean('related_optoins'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});


export const metricOptions = pgTable('metric_options', {
    id: serial('id').primaryKey(),
    metricId: integer('metric_id').notNull().references(() => metrics.id, { onDelete: "cascade" }),
    name: varchar('name', { length: 100 }),
    shortDescription: varchar('short_description', { length: 500 }),
    description: varchar('description', { length: 1000 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const evaluations = pgTable('evaluations', {
    id: serial('id').primaryKey(),
    movieId: uuid('movie_id').notNull().references(() => movies.id, { onDelete: "cascade" }),
    metricId: integer('metric_id').notNull().references(() => metrics.id),
    userId: text('user_id').notNull().references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    comment: text('comment')
}, (evaluation) => ({
    everyUserOnceIdx: uniqueIndex('every_user_once_idx').on(evaluation.movieId, evaluation.metricId, evaluation.userId)
}));

export const evaluationResults = pgTable('evaluation_results', {
    evaluationId: integer('evaluation_id').notNull().references(() => evaluations.id, { onDelete: "cascade" }),
    metricOptionsId: integer('metric_option_id').notNull().references(() => metricOptions.id, { onDelete: "cascade" })
}, (evaluationResult) => ({
    compoundKey: primaryKey({ columns: [evaluationResult.evaluationId, evaluationResult.metricOptionsId]})
}));