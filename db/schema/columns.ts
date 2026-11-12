import { integer } from 'drizzle-orm/sqlite-core';

/**
 * `created_at` / `updated_at` as epoch milliseconds. The app fills both on insert and Drizzle
 * bumps `updated_at` on every update; pin it with ``updatedAt: sql`${col}` `` when a write is
 * not an edit.
 */
export const timestamps = () => ({
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date())
});

/** A `created_at` column on tables that are written once. */
export const createdAt = () =>
	integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date());

/** The nine Unconsenting Media flags, shared by `um_source` and `community_um_reports`. */
export const umFlagColumns = () => ({
	noRape: integer('no_rape', { mode: 'boolean' }).notNull(),
	rapeMenDisImp: integer('rape_men_dis_imp', { mode: 'boolean' }).notNull(),
	sexHarOnScrn: integer('sex_har_on_scrn', { mode: 'boolean' }).notNull(),
	sexAdultTeen: integer('sex_adult_teen', { mode: 'boolean' }).notNull(),
	childSexAbuse: integer('child_sex_abuse', { mode: 'boolean' }).notNull(),
	incest: integer('incest', { mode: 'boolean' }).notNull(),
	attemptedRape: integer('attempted_rape', { mode: 'boolean' }).notNull(),
	rapeOffScrn: integer('rape_off_scrn', { mode: 'boolean' }).notNull(),
	rapeOnScreen: integer('rape_on_screen', { mode: 'boolean' }).notNull()
});
