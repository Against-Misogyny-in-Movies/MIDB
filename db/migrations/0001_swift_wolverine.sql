CREATE TYPE "public"."user_role" AS ENUM('user', 'moderator', 'administrator');--> statement-breakpoint
CREATE TYPE "public"."metric_kind" AS ENUM('bechdel', 'unconsenting', 'ddd');--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_metric_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"metric" "metric_kind" NOT NULL,
	"value" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movie_trigger_tags" DROP CONSTRAINT "movie_trigger_tags_created_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "username" varchar(32);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "avatar_key" varchar(48);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_metric_submissions" ADD CONSTRAINT "community_metric_submissions_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_metric_submissions" ADD CONSTRAINT "community_metric_submissions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_movie_idx" ON "comments" USING btree ("movie_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_user_idx" ON "comments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cms_user_movie_metric_idx" ON "community_metric_submissions" USING btree ("user_id","movie_id","metric");--> statement-breakpoint
CREATE INDEX "cms_movie_metric_idx" ON "community_metric_submissions" USING btree ("movie_id","metric");--> statement-breakpoint
CREATE INDEX "cms_user_created_idx" ON "community_metric_submissions" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "movie_trigger_tags" ADD CONSTRAINT "movie_trigger_tags_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_username_lower_idx" ON "user" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "emailVerified";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "image";