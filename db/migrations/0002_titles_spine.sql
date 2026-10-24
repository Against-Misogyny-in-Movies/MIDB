CREATE TYPE "public"."comment_status" AS ENUM('visible', 'hidden', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."title_kind" AS ENUM('movie', 'tv');--> statement-breakpoint
CREATE TABLE "community_bechdel_ratings" (
	"user_id" text NOT NULL,
	"title_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_bechdel_ratings_user_id_title_id_pk" PRIMARY KEY("user_id","title_id"),
	CONSTRAINT "cbr_rating_range" CHECK ("community_bechdel_ratings"."rating" >= 0 AND "community_bechdel_ratings"."rating" <= 3)
);
--> statement-breakpoint
CREATE TABLE "community_ddd_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title_id" uuid NOT NULL,
	"topic_id" integer NOT NULL,
	"season" integer,
	"episode" integer,
	"yes" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cdv_vote_uniq" UNIQUE NULLS NOT DISTINCT("user_id","title_id","topic_id","season","episode")
);
--> statement-breakpoint
CREATE TABLE "community_um_reports" (
	"user_id" text NOT NULL,
	"title_id" uuid NOT NULL,
	"no_rape" boolean NOT NULL,
	"rape_men_dis_imp" boolean NOT NULL,
	"sex_har_on_scrn" boolean NOT NULL,
	"sex_adult_teen" boolean NOT NULL,
	"child_sex_abuse" boolean NOT NULL,
	"incest" boolean NOT NULL,
	"attempted_rape" boolean NOT NULL,
	"rape_off_scrn" boolean NOT NULL,
	"rape_on_screen" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_um_reports_user_id_title_id_pk" PRIMARY KEY("user_id","title_id")
);
--> statement-breakpoint
CREATE TABLE "title_um" (
	"title_id" uuid PRIMARY KEY NOT NULL,
	"um_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "community_metric_submissions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "movie_trigger_tags" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "community_metric_submissions" CASCADE;--> statement-breakpoint
DROP TABLE "movie_trigger_tags" CASCADE;--> statement-breakpoint
ALTER TABLE "movies" RENAME TO "titles";--> statement-breakpoint
ALTER TABLE "movie_bechdel" RENAME TO "title_bechdel";--> statement-breakpoint
ALTER TABLE "comments" RENAME COLUMN "movie_id" TO "title_id";--> statement-breakpoint
ALTER TABLE "title_bechdel" RENAME COLUMN "movie_id" TO "title_id";--> statement-breakpoint
ALTER TABLE "titles" DROP CONSTRAINT "movies_imdb_id_unique";--> statement-breakpoint
ALTER TABLE "titles" DROP CONSTRAINT "movies_tmdb_id_unique";--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_movie_id_movies_id_fk";
--> statement-breakpoint
ALTER TABLE "title_bechdel" DROP CONSTRAINT "movie_bechdel_movie_id_movies_id_fk";
--> statement-breakpoint
DROP INDEX "comments_movie_idx";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "title_bechdel" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "title_bechdel" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "titles" ALTER COLUMN "imdb_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "titles" ALTER COLUMN "year" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "titles" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "titles" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "titles" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "titles" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "status" "comment_status" DEFAULT 'visible' NOT NULL;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "kind" "title_kind" DEFAULT 'movie' NOT NULL;--> statement-breakpoint
-- Hand-appended data migration (not generated). Runs after the renames and column changes,
-- before movie_unconsenting is dropped and before the new unique/check constraints.
UPDATE "titles" SET "kind" = 'tv', "tmdb_id" = substring("imdb_id" from 9)::int, "imdb_id" = NULL WHERE "imdb_id" LIKE 'tmdb-tv:%';--> statement-breakpoint
UPDATE "titles" SET "tmdb_id" = substring("imdb_id" from 6)::int, "imdb_id" = NULL WHERE "imdb_id" LIKE 'tmdb:%';--> statement-breakpoint
UPDATE "titles" SET "year" = NULL WHERE "year" <= 0;--> statement-breakpoint
UPDATE "um_source" SET "year" = NULL WHERE "year" <= 0;--> statement-breakpoint
INSERT INTO "title_um" ("title_id", "um_id", "created_at")
  SELECT mu."movie_id", mu."um_id", mu."created_at" AT TIME ZONE 'UTC' FROM "movie_unconsenting" mu JOIN "um_source" us USING ("um_id");--> statement-breakpoint
ALTER TABLE "titles" ALTER COLUMN "kind" DROP DEFAULT;--> statement-breakpoint
-- End of hand-appended data migration.
ALTER TABLE "movie_unconsenting" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "movie_unconsenting" CASCADE;--> statement-breakpoint
ALTER TABLE "community_bechdel_ratings" ADD CONSTRAINT "community_bechdel_ratings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_bechdel_ratings" ADD CONSTRAINT "community_bechdel_ratings_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_ddd_votes" ADD CONSTRAINT "community_ddd_votes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_ddd_votes" ADD CONSTRAINT "community_ddd_votes_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_um_reports" ADD CONSTRAINT "community_um_reports_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_um_reports" ADD CONSTRAINT "community_um_reports_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_um" ADD CONSTRAINT "title_um_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_um" ADD CONSTRAINT "title_um_um_id_um_source_um_id_fk" FOREIGN KEY ("um_id") REFERENCES "public"."um_source"("um_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cbr_title_idx" ON "community_bechdel_ratings" USING btree ("title_id");--> statement-breakpoint
CREATE INDEX "cdv_title_topic_idx" ON "community_ddd_votes" USING btree ("title_id","topic_id");--> statement-breakpoint
CREATE INDEX "cur_title_idx" ON "community_um_reports" USING btree ("title_id");--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_bechdel" ADD CONSTRAINT "title_bechdel_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_title_idx" ON "comments" USING btree ("title_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "titles_kind_tmdb_idx" ON "titles" USING btree ("kind","tmdb_id");--> statement-breakpoint
ALTER TABLE "titles" ADD CONSTRAINT "titles_imdb_id_unique" UNIQUE("imdb_id");--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_body_length" CHECK (char_length("comments"."body") BETWEEN 1 AND 5000);--> statement-breakpoint
DROP TYPE "public"."metric_kind";