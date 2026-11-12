CREATE TABLE `community_content_reports` (
	`user_id` text NOT NULL,
	`title_id` text NOT NULL,
	`sexual_present` text,
	`partner_level` text,
	`physical_level` text,
	`stalking_level` text,
	`objectification_level` text,
	`rape_men_dis_imp` integer,
	`sex_har_on_scrn` integer,
	`sex_adult_teen` integer,
	`child_sex_abuse` integer,
	`incest` integer,
	`attempted_rape` integer,
	`rape_off_scrn` integer,
	`rape_on_screen` integer,
	`framing` text,
	`status` text DEFAULT 'counted' NOT NULL,
	`hold_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `title_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ccr_sexual_present_check" CHECK("community_content_reports"."sexual_present" IN ('none', 'present')),
	CONSTRAINT "ccr_partner_level_check" CHECK("community_content_reports"."partner_level" IN ('none', 'mentioned', 'on_screen')),
	CONSTRAINT "ccr_physical_level_check" CHECK("community_content_reports"."physical_level" IN ('none', 'mentioned', 'on_screen')),
	CONSTRAINT "ccr_stalking_level_check" CHECK("community_content_reports"."stalking_level" IN ('none', 'mentioned', 'on_screen')),
	CONSTRAINT "ccr_objectification_level_check" CHECK("community_content_reports"."objectification_level" IN ('none', 'some_scenes', 'throughout')),
	CONSTRAINT "ccr_framing_check" CHECK("community_content_reports"."framing" IN ('condemned', 'unclear', 'played_for_laughs', 'glamorised_or_justified')),
	CONSTRAINT "ccr_status_check" CHECK("community_content_reports"."status" IN ('counted', 'held', 'rejected')),
	CONSTRAINT "ccr_hold_reason_check" CHECK("community_content_reports"."hold_reason" IN ('contradicts_source', 'burst', 'busy_new_account'))
);
--> statement-breakpoint
CREATE INDEX `ccr_title_status_idx` ON `community_content_reports` (`title_id`,`status`);--> statement-breakpoint
CREATE INDEX `ccr_user_created_idx` ON `community_content_reports` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `title_count_flags` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "tcf_status_check" CHECK("title_count_flags"."status" IN ('open', 'resolved', 'dismissed')),
	CONSTRAINT "tcf_note_length" CHECK(length("title_count_flags"."note") <= 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tcf_title_reporter_uniq` ON `title_count_flags` (`title_id`,`reporter_id`);--> statement-breakpoint
CREATE INDEX `tcf_status_title_idx` ON `title_count_flags` (`status`,`title_id`);