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

/** The eight concern flags (every Unconsenting Media flag but `noRape`) and their SQL column names. */
const CONCERN_FLAG_SQL_NAMES = {
	rapeMenDisImp: 'rape_men_dis_imp',
	sexHarOnScrn: 'sex_har_on_scrn',
	sexAdultTeen: 'sex_adult_teen',
	childSexAbuse: 'child_sex_abuse',
	incest: 'incest',
	attemptedRape: 'attempted_rape',
	rapeOffScrn: 'rape_off_scrn',
	rapeOnScreen: 'rape_on_screen'
} as const;

const booleanFlag = (name: string) => integer(name, { mode: 'boolean' });
type NotNullFlag = ReturnType<ReturnType<typeof booleanFlag>['notNull']>;

/**
 * The eight concern flags as nullable columns, for a reader's answers, where NULL is "not
 * sure". `readerReports.spec.ts` keeps the key list in step with `UM_FLAGS`.
 */
export const umConcernFlagColumns = () =>
	Object.fromEntries(
		Object.entries(CONCERN_FLAG_SQL_NAMES).map(([key, name]) => [key, booleanFlag(name)])
	) as { [K in keyof typeof CONCERN_FLAG_SQL_NAMES]: ReturnType<typeof booleanFlag> };

/** The nine Unconsenting Media flags, shared by `um_source` and `community_um_reports`. */
export const umFlagColumns = () => ({
	noRape: booleanFlag('no_rape').notNull(),
	...(Object.fromEntries(
		Object.entries(umConcernFlagColumns()).map(([key, column]) => [key, column.notNull()])
	) as { [K in keyof ReturnType<typeof umConcernFlagColumns>]: NotNullFlag })
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
