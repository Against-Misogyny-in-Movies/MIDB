CREATE TABLE `retired_username` (
	`username` text(32) PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`retired_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `retired_username_user_id_idx` ON `retired_username` (`user_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `username_changed_at` integer;