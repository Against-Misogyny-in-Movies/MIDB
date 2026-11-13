PRAGMA defer_foreign_keys = on;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_moderation_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`target_comment_id` text,
	`target_user_id` text,
	`target_title_id` text,
	`action` text NOT NULL,
	`reason` text,
	`mute_hours` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "moderation_actions_action_check" CHECK("__new_moderation_actions"."action" IN ('approve', 'hide', 'reject', 'restore', 'dismiss', 'mute', 'ban', 'approve_report', 'reject_report', 'reject_account_reports', 'resolve_count_flag', 'dismiss_count_flag')),
	CONSTRAINT "moderation_actions_mute_hours" CHECK("__new_moderation_actions"."mute_hours" IS NULL OR "__new_moderation_actions"."mute_hours" > 0),
	CONSTRAINT "moderation_actions_reason_length" CHECK(length("__new_moderation_actions"."reason") <= 140)
);
--> statement-breakpoint
INSERT INTO `__new_moderation_actions`("id", "actor_id", "target_comment_id", "target_user_id", "action", "reason", "mute_hours", "created_at") SELECT "id", "actor_id", "target_comment_id", "target_user_id", "action", "reason", "mute_hours", "created_at" FROM `moderation_actions`;--> statement-breakpoint
DROP TABLE `moderation_actions`;--> statement-breakpoint
ALTER TABLE `__new_moderation_actions` RENAME TO `moderation_actions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `moderation_actions_created_idx` ON `moderation_actions` (`created_at`);--> statement-breakpoint
CREATE INDEX `moderation_actions_comment_idx` ON `moderation_actions` (`target_comment_id`);