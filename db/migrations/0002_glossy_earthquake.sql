CREATE TABLE IF NOT EXISTS "evaluation_results" (
	"evaluation_id" integer NOT NULL,
	"metric_option_id" integer NOT NULL,
	CONSTRAINT evaluation_results_evaluation_id_metric_option_id_pk PRIMARY KEY("evaluation_id","metric_option_id")
);

CREATE TABLE IF NOT EXISTS "evaluations" (
	"id" serial PRIMARY KEY NOT NULL,
	"movie_id" uuid NOT NULL,
	"metric_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"comment" text
);

CREATE TABLE IF NOT EXISTS "metric_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"metric_id" integer NOT NULL,
	"name" varchar(100),
	"short_description" varchar(500),
	"description" varchar(1000),
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100),
	"slug" varchar(100),
	"short_description" varchar(500),
	"description" varchar(1000),
	"related_optoins" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "metrics_slug_unique" UNIQUE("slug")
);

CREATE UNIQUE INDEX IF NOT EXISTS "every_user_once_idx" ON "evaluations" ("movie_id","metric_id","user_id");
DO $$ BEGIN
 ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_metric_option_id_metric_options_id_fk" FOREIGN KEY ("metric_option_id") REFERENCES "metric_options"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_metric_id_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "metrics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "metric_options" ADD CONSTRAINT "metric_options_metric_id_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "metrics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
