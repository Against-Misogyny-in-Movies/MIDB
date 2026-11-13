import { sqliteTable, text, integer, index, uniqueIndex, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { createdAt, enumCheck, timestamps } from './columns.ts';

export const userRole = ['user', 'moderator', 'administrator'] as const;

/**
 * The Better Auth tables (`user`, `session`, `account`, `verification`, `passkey`), generated
 * with the `auth` CLI (`generate --adapter drizzle --dialect sqlite`) and merged here. Better
 * Auth reads them through the `schema` map in `#lib/server/auth/create-auth.ts`, which names each
 * table by its model (`user`, `session`, …).
 *
 * `user` adds MIDB's own columns: `role`, `username` and `avatar_key` (declared to Better Auth
 * as non-input `additionalFields`) and the moderation state `banned_at`, `ban_reason` and
 * `muted_until`, which only the moderation code writes. A passkey-only account has no real
 * email, so its `email` is a `<id>@users.invalid` placeholder (`#lib/server/auth/placeholder-email.ts`).
 */
export const users = sqliteTable(
	'user',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull().unique(),
		emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
		image: text('image'),
		role: text('role', { enum: userRole }).notNull().default('user'),
		username: text('username', { length: 32 }),
		avatarKey: text('avatar_key', { length: 48 }),
		/** Set when a moderator bans the account; a banned user cannot start a session. */
		bannedAt: integer('banned_at', { mode: 'timestamp_ms' }),
		banReason: text('ban_reason', { length: 500 }),
		/** While in the future the user cannot write comments. */
		mutedUntil: integer('muted_until', { mode: 'timestamp_ms' }),
		/** When the username last changed by a rename; null until the first one. */
		usernameChangedAt: integer('username_changed_at', { mode: 'timestamp_ms' }),
		...timestamps()
	},
	(t) => [
		uniqueIndex('user_username_lower_idx').on(sql`lower(${t.username})`),
		index('user_role_idx').on(t.role),
		enumCheck('user_role_check', t.role, userRole),
		check('user_username_length', sql`length(${t.username}) <= 32`),
		check('user_avatar_key_length', sql`length(${t.avatarKey}) <= 48`),
		check('user_ban_reason_length', sql`length(${t.banReason}) <= 500`)
	]
);

/**
 * A username its owner gave up, held back from everyone else for a while
 * (`RETIRED_USERNAME_DAYS` in `#lib/media/utils/username.ts`). `username` is the lowercased
 * name; `user_id` is the former owner, who may take it back.
 */
export const retiredUsernames = sqliteTable(
	'retired_username',
	{
		username: text('username', { length: 32 }).primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		retiredAt: integer('retired_at', { mode: 'timestamp_ms' }).notNull()
	},
	(t) => [index('retired_username_user_id_idx').on(t.userId)]
);

export const sessions = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		token: text('token').notNull().unique(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		...timestamps()
	},
	(t) => [index('session_user_id_idx').on(t.userId)]
);

export const accounts = sqliteTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
		refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
		scope: text('scope'),
		password: text('password'),
		...timestamps()
	},
	(t) => [index('account_user_id_idx').on(t.userId)]
);

export const verifications = sqliteTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		...timestamps()
	},
	(t) => [index('verification_identifier_idx').on(t.identifier)]
);

export const passkeys = sqliteTable(
	'passkey',
	{
		id: text('id').primaryKey(),
		name: text('name'),
		publicKey: text('public_key').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		credentialID: text('credential_id').notNull().unique(),
		counter: integer('counter').notNull(),
		deviceType: text('device_type').notNull(),
		backedUp: integer('backed_up', { mode: 'boolean' }).notNull(),
		transports: text('transports'),
		aaguid: text('aaguid'),
		// Better Auth sets it on registration; the table has no `updated_at`, so not `timestamps()`.
		createdAt: createdAt()
	},
	(t) => [index('passkey_user_id_idx').on(t.userId)]
);
