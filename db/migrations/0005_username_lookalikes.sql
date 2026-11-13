ALTER TABLE `retired_username` ADD `username_folded` text GENERATED ALWAYS AS (replace(replace(lower("username"), '1', 'l'), '0', 'o')) VIRTUAL;--> statement-breakpoint
CREATE INDEX `retired_username_folded_idx` ON `retired_username` (`username_folded`);--> statement-breakpoint
ALTER TABLE `user` ADD `username_folded` text GENERATED ALWAYS AS (replace(replace(lower("username"), '1', 'l'), '0', 'o')) VIRTUAL;--> statement-breakpoint
CREATE INDEX `user_username_folded_idx` ON `user` (`username_folded`);