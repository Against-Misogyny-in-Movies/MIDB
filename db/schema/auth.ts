import { sqliteTable, text, index, uniqueIndex, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { timestamps } from './columns.ts';

export const userRole = ['user', 'moderator', 'administrator'] as const;

export const users = sqliteTable(
	'user',
	{
		id: text('id').primaryKey(),
		email: text('email'),
		role: text('role', { enum: userRole }).notNull().default('user'),
		username: text('username', { length: 32 }),
		avatarKey: text('avatar_key', { length: 48 }),
		...timestamps()
	},
	(t) => [
		uniqueIndex('user_username_lower_idx').on(sql`lower(${t.username})`),
		index('user_role_idx').on(t.role),
		check('user_role_check', sql`${t.role} IN ('user', 'moderator', 'administrator')`)
	]
);
