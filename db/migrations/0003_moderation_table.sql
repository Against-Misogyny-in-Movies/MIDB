CREATE TABLE `comment_ai_labels` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`concern` text NOT NULL,
	`matched` integer NOT NULL,
	`categories` text NOT NULL,
	`severity` integer NOT NULL,
	`reason` text NOT NULL,
	`model` text NOT NULL,
	`scanned_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scanned_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "comment_ai_labels_categories_json" CHECK(json_valid("comment_ai_labels"."categories")),
	CONSTRAINT "comment_ai_labels_concern_length" CHECK(length("comment_ai_labels"."concern") BETWEEN 1 AND 200),
	CONSTRAINT "comment_ai_labels_severity_range" CHECK("comment_ai_labels"."severity" >= 0 AND "comment_ai_labels"."severity" <= 3)
);
--> statement-breakpoint
CREATE INDEX `comment_ai_labels_comment_idx` ON `comment_ai_labels` (`comment_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_status_created_idx` ON `comments` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_created_idx` ON `comments` (`created_at`);