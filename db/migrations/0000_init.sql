CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `passkey` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`public_key` text NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`counter` integer NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` integer NOT NULL,
	`transports` text,
	`aaguid` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passkey_credential_id_unique` ON `passkey` (`credential_id`);--> statement-breakpoint
CREATE INDEX `passkey_user_id_idx` ON `passkey` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'user' NOT NULL,
	`username` text(32),
	`avatar_key` text(48),
	`banned_at` integer,
	`ban_reason` text(500),
	`muted_until` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "user_role_check" CHECK("user"."role" IN ('user', 'moderator', 'administrator')),
	CONSTRAINT "user_username_length" CHECK(length("user"."username") <= 32),
	CONSTRAINT "user_avatar_key_length" CHECK(length("user"."avatar_key") <= 48),
	CONSTRAINT "user_ban_reason_length" CHECK(length("user"."ban_reason") <= 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_lower_idx` ON `user` (lower("username"));--> statement-breakpoint
CREATE INDEX `user_role_idx` ON `user` (`role`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `comment_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "comment_reports_reason_check" CHECK("comment_reports"."reason" IN ('hate', 'harassment', 'spam', 'sexual-content', 'threat', 'other')),
	CONSTRAINT "comment_reports_status_check" CHECK("comment_reports"."status" IN ('open', 'resolved', 'dismissed')),
	CONSTRAINT "comment_reports_note_length" CHECK(length("comment_reports"."note") <= 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comment_reports_uniq` ON `comment_reports` (`comment_id`,`reporter_id`);--> statement-breakpoint
CREATE INDEX `comment_reports_status_idx` ON `comment_reports` (`comment_id`,`status`);--> statement-breakpoint
CREATE TABLE `comment_votes` (
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`value` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`comment_id`, `user_id`),
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "comment_votes_value" CHECK("comment_votes"."value" IN (-1, 1))
);
--> statement-breakpoint
CREATE INDEX `comment_votes_user_idx` ON `comment_votes` (`user_id`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`root_id` text,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`reply_count` integer DEFAULT 0 NOT NULL,
	`edited_at` integer,
	`moderation_source` text,
	`moderation_reason` text,
	`ai_verdict` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`root_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "comments_body_length" CHECK(length("comments"."body") BETWEEN 1 AND 5000),
	CONSTRAINT "comments_reason_length" CHECK(length("comments"."moderation_reason") <= 140),
	CONSTRAINT "comments_ai_verdict_json" CHECK("comments"."ai_verdict" IS NULL OR json_valid("comments"."ai_verdict")),
	CONSTRAINT "comments_status_check" CHECK("comments"."status" IN ('pending', 'published', 'hidden', 'rejected', 'deleted')),
	CONSTRAINT "comments_source_check" CHECK("comments"."moderation_source" IN ('ai', 'blocklist', 'moderator', 'reports'))
);
--> statement-breakpoint
CREATE INDEX `comments_title_status_created_idx` ON `comments` (`title_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_title_status_score_idx` ON `comments` (`title_id`,`status`,`score`);--> statement-breakpoint
CREATE INDEX `comments_root_idx` ON `comments` (`root_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_user_idx` ON `comments` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `community_bechdel_ratings` (
	`user_id` text NOT NULL,
	`title_id` text NOT NULL,
	`rating` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `title_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "cbr_rating_range" CHECK("community_bechdel_ratings"."rating" >= 0 AND "community_bechdel_ratings"."rating" <= 3)
);
--> statement-breakpoint
CREATE INDEX `cbr_title_idx` ON `community_bechdel_ratings` (`title_id`);--> statement-breakpoint
CREATE TABLE `community_ddd_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title_id` text NOT NULL,
	`topic_id` integer NOT NULL,
	`season` integer,
	`episode` integer,
	`yes` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cdv_vote_uniq` ON `community_ddd_votes` (`user_id`,`title_id`,`topic_id`,CASE WHEN "season" IS NULL THEN -1 ELSE "season" END,CASE WHEN "episode" IS NULL THEN -1 ELSE "episode" END);--> statement-breakpoint
CREATE INDEX `cdv_title_topic_idx` ON `community_ddd_votes` (`title_id`,`topic_id`);--> statement-breakpoint
CREATE TABLE `community_um_reports` (
	`user_id` text NOT NULL,
	`title_id` text NOT NULL,
	`no_rape` integer NOT NULL,
	`rape_men_dis_imp` integer NOT NULL,
	`sex_har_on_scrn` integer NOT NULL,
	`sex_adult_teen` integer NOT NULL,
	`child_sex_abuse` integer NOT NULL,
	`incest` integer NOT NULL,
	`attempted_rape` integer NOT NULL,
	`rape_off_scrn` integer NOT NULL,
	`rape_on_screen` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `title_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cur_title_idx` ON `community_um_reports` (`title_id`);--> statement-breakpoint
CREATE TABLE `moderation_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`target_comment_id` text,
	`target_user_id` text,
	`action` text NOT NULL,
	`reason` text,
	`mute_hours` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "moderation_actions_action_check" CHECK("moderation_actions"."action" IN ('approve', 'hide', 'reject', 'restore', 'dismiss', 'mute', 'ban')),
	CONSTRAINT "moderation_actions_mute_hours" CHECK("moderation_actions"."mute_hours" IS NULL OR "moderation_actions"."mute_hours" > 0),
	CONSTRAINT "moderation_actions_reason_length" CHECK(length("moderation_actions"."reason") <= 140)
);
--> statement-breakpoint
CREATE INDEX `moderation_actions_created_idx` ON `moderation_actions` (`created_at`);--> statement-breakpoint
CREATE INDEX `moderation_actions_comment_idx` ON `moderation_actions` (`target_comment_id`);--> statement-breakpoint
CREATE TABLE `titles` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`tmdb_id` integer,
	`imdb_id` text,
	`title` text(255) NOT NULL,
	`clean_title` text(255) NOT NULL,
	`year` integer,
	`popularity` real,
	`popularity_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "titles_kind_check" CHECK("titles"."kind" IN ('movie', 'tv')),
	CONSTRAINT "titles_title_length" CHECK(length("titles"."title") <= 255),
	CONSTRAINT "titles_clean_title_length" CHECK(length("titles"."clean_title") <= 255)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `titles_imdb_id_unique` ON `titles` (`imdb_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `titles_kind_tmdb_idx` ON `titles` (`kind`,`tmdb_id`);--> statement-breakpoint
CREATE INDEX `titles_popularity_idx` ON `titles` (`popularity`);--> statement-breakpoint
CREATE TABLE `source_sync` (
	`source` text PRIMARY KEY NOT NULL,
	`last_success_at` integer NOT NULL,
	`rows_changed` integer NOT NULL,
	CONSTRAINT "source_sync_source_check" CHECK("source_sync"."source" IN ('bechdel', 'bechdel_sweep', 'um', 'popularity'))
);
--> statement-breakpoint
CREATE TABLE `title_bechdel` (
	`title_id` text PRIMARY KEY NOT NULL,
	`bechdel_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "rating_range" CHECK(rating >= 0 AND rating <= 3)
);
--> statement-breakpoint
CREATE TABLE `title_um` (
	`title_id` text PRIMARY KEY NOT NULL,
	`um_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`um_id`) REFERENCES `um_source`(`um_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `um_source` (
	`um_id` integer PRIMARY KEY NOT NULL,
	`clean_name` text NOT NULL,
	`clean_title_key` text NOT NULL,
	`year` integer,
	`no_rape` integer NOT NULL,
	`rape_men_dis_imp` integer NOT NULL,
	`sex_har_on_scrn` integer NOT NULL,
	`sex_adult_teen` integer NOT NULL,
	`child_sex_abuse` integer NOT NULL,
	`incest` integer NOT NULL,
	`attempted_rape` integer NOT NULL,
	`rape_off_scrn` integer NOT NULL,
	`rape_on_screen` integer NOT NULL,
	`comment` text,
	`source_updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `um_source_clean_title_key_idx` ON `um_source` (`clean_title_key`);