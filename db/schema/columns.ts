import { boolean, timestamp } from 'drizzle-orm/pg-core';

/** `created_at` / `updated_at` as timestamptz; Drizzle bumps `updated_at` on every update. */
export const timestamps = () => ({
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date())
});

/** The nine Unconsenting Media flags, shared by `um_source` and `community_um_reports`. */
export const umFlagColumns = () => ({
	noRape: boolean('no_rape').notNull(),
	rapeMenDisImp: boolean('rape_men_dis_imp').notNull(),
	sexHarOnScrn: boolean('sex_har_on_scrn').notNull(),
	sexAdultTeen: boolean('sex_adult_teen').notNull(),
	childSexAbuse: boolean('child_sex_abuse').notNull(),
	incest: boolean('incest').notNull(),
	attemptedRape: boolean('attempted_rape').notNull(),
	rapeOffScrn: boolean('rape_off_scrn').notNull(),
	rapeOnScreen: boolean('rape_on_screen').notNull()
});
