import { relations } from 'drizzle-orm';
import { users } from './auth';
import { movies } from './movie';
import { pgTable, uuid, integer, boolean, timestamp, serial, text, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';


export const metrics = pgTable('metrics', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    shortDescription: text('short_description').notNull(),
    description: text('description'),
    relatedOptions: boolean('related_options').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const metricRelations = relations(metrics, ({ many }) => ({
    options: many(metricOptions)
}));

export const metricOptions = pgTable('metric_options', {
    id: serial('id').primaryKey(),
    metricId: text('metric_id').notNull().references(() => metrics.id, { onDelete: "cascade" }),
    name: text('name').notNull(),
    shortDescription: text('short_description').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const metricOptionRelations = relations(metricOptions, ({ one }) => ({
    metric: one(metrics, { fields: [metricOptions.metricId], references: [metrics.id]})
}));

export const evaluations = pgTable('evaluations', {
    id: serial('id').primaryKey(),
    movieId: uuid('movie_id').notNull().references(() => movies.id, { onDelete: "cascade" }),
    metricId: text('metric_id').notNull().references(() => metrics.id),
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