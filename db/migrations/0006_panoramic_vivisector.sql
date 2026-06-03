CREATE TABLE "movie_bechdel" (
	"movie_id" uuid PRIMARY KEY NOT NULL,
	"bechdel_id" integer NOT NULL,
	"rating" smallint NOT NULL,
	"num_votes" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rating_range" CHECK (rating >= 0 AND rating <= 3)
);
--> statement-breakpoint
CREATE TABLE "movie_trigger_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"movie_id" uuid NOT NULL,
	"topic_id" integer NOT NULL,
	"does_name" varchar NOT NULL,
	"yes_sum" integer NOT NULL,
	"no_sum" integer NOT NULL,
	"comment" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movie_unconsenting" (
	"movie_id" uuid PRIMARY KEY NOT NULL,
	"um_id" integer NOT NULL,
	"clean_name" varchar NOT NULL,
	"item_type" varchar,
	"comment" text,
	"no_rape" boolean NOT NULL,
	"rape_men_dis_imp" boolean NOT NULL,
	"sex_har_on_scrn" boolean NOT NULL,
	"sex_adult_teen" boolean NOT NULL,
	"child_sex_abuse" boolean NOT NULL,
	"incest" boolean NOT NULL,
	"attempted_rape" boolean NOT NULL,
	"rape_off_scrn" boolean NOT NULL,
	"rape_on_screen" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movies" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "imdb_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "year" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "movies" ADD COLUMN "clean_title" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "movie_bechdel" ADD CONSTRAINT "movie_bechdel_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_trigger_tags" ADD CONSTRAINT "movie_trigger_tags_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_trigger_tags" ADD CONSTRAINT "movie_trigger_tags_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_unconsenting" ADD CONSTRAINT "movie_unconsenting_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "movie_trigger_tags_movie_topic_idx" ON "movie_trigger_tags" USING btree ("movie_id","topic_id");--> statement-breakpoint
ALTER TABLE "movies" ADD CONSTRAINT "movies_imdb_id_unique" UNIQUE("imdb_id");
--> statement-breakpoint
DROP TABLE IF EXISTS "evaluation_results";
--> statement-breakpoint
DROP TABLE IF EXISTS "evaluations";
--> statement-breakpoint
DROP TABLE IF EXISTS "metric_options";
--> statement-breakpoint
DROP TABLE IF EXISTS "metrics";