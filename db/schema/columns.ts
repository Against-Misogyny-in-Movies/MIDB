import { sql, type SQL } from 'drizzle-orm';
import { check, integer, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

/** A `created_at` column on tables that are written once. */
export const createdAt = () =>
	integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date());

/**
 * `created_at` / `updated_at` as epoch milliseconds. The app fills both on insert and Drizzle
 * bumps `updated_at` on every update; pin it with ``updatedAt: sql`${col}` `` when a write is
 * not an edit.
 */
export const timestamps = () => ({
	createdAt: createdAt(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdate(() => new Date())
});

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

/**
 * The eight concern flags of `umFlagColumns()` (every flag but `noRape`) as nullable columns,
 * for a reader's answers, where NULL is "not sure". `readerReports.spec.ts` keeps the
 * key list in step with `UM_FLAGS`.
 */
export const umConcernFlagColumns = () => ({
	rapeMenDisImp: integer('rape_men_dis_imp', { mode: 'boolean' }),
	sexHarOnScrn: integer('sex_har_on_scrn', { mode: 'boolean' }),
	sexAdultTeen: integer('sex_adult_teen', { mode: 'boolean' }),
	childSexAbuse: integer('child_sex_abuse', { mode: 'boolean' }),
	incest: integer('incest', { mode: 'boolean' }),
	attemptedRape: integer('attempted_rape', { mode: 'boolean' }),
	rapeOffScrn: integer('rape_off_scrn', { mode: 'boolean' }),
	rapeOnScreen: integer('rape_on_screen', { mode: 'boolean' })
});

/** A CHECK that `column` holds one of `values`, so the constraint is built from the enum tuple. */
export function enumCheck(
	name: string,
	column: AnySQLiteColumn,
	values: readonly string[]
): ReturnType<typeof check> {
	// A CHECK in DDL cannot bind parameters, so the values are inlined as quoted literals.
	const list: SQL = sql.raw(values.map((v) => `'${v.replaceAll("'", "''")}'`).join(', '));
	return check(name, sql`${column} IN (${list})`);
}
