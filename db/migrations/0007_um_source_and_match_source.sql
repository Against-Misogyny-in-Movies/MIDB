CREATE TABLE "um_source" (
	"um_id" integer PRIMARY KEY NOT NULL,
	"clean_name" varchar NOT NULL,
	"clean_title_key" varchar NOT NULL,
	"year" integer,
	"no_rape" boolean NOT NULL,
	"rape_men_dis_imp" boolean NOT NULL,
	"sex_har_on_scrn" boolean NOT NULL,
	"sex_adult_teen" boolean NOT NULL,
	"child_sex_abuse" boolean NOT NULL,
	"incest" boolean NOT NULL,
	"attempted_rape" boolean NOT NULL,
	"rape_off_scrn" boolean NOT NULL,
	"rape_on_screen" boolean NOT NULL,
	"comment" text
);
--> statement-breakpoint
ALTER TABLE "movie_unconsenting" ADD COLUMN "match_source" varchar DEFAULT 'seed-auto' NOT NULL;
