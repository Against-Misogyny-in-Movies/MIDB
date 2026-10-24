import { pgTable, text, varchar, timestamp, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const userRole = pgEnum('user_role', ['user', 'moderator', 'administrator']);

export const users = pgTable(
	'user',
	{
		id: text('id').primaryKey(),
		email: text('email'),
		role: userRole('role').notNull().default('user'),
		username: varchar('username', { length: 32 }),
		avatarKey: varchar('avatar_key', { length: 48 }),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('user_username_lower_idx').on(sql`lower(${t.username})`),
		index('user_role_idx').on(t.role)
	]
);
