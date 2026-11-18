import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const DIR = new URL('../migrations/', import.meta.url);

/** The statements of one migration, split where the generator put its breakpoints. */
const statements = (file: string) =>
	readFileSync(new URL(file, DIR), 'utf8')
		.split('--> statement-breakpoint')
		.map((s) => s.trim())
		.filter(Boolean);

const migrations = readdirSync(DIR)
	.filter((f) => f.endsWith('.sql'))
	.sort();
const RULES = migrations.find((f) => f.startsWith('0007_'));

/** Runs a migration's statements in one transaction, as D1 does, with foreign keys on. */
function apply(db: DatabaseSync, file: string) {
	db.exec('BEGIN');
	try {
		for (const statement of statements(file)) db.exec(statement);
		db.exec('COMMIT');
	} catch (error) {
		db.exec('ROLLBACK');
		throw error;
	}
}

/** Inserts one row, giving every required column without a default a plain value. */
function insert(db: DatabaseSync, table: string, values: Record<string, string | number | null>) {
	const columns = db.prepare(`PRAGMA table_info(\`${table}\`)`).all() as {
		name: string;
		type: string;
		notnull: number;
		dflt_value: string | null;
	}[];
	const row: Record<string, string | number | null> = { ...values };
	for (const c of columns) {
		if (c.name in row || !c.notnull || c.dflt_value !== null) continue;
		row[c.name] = c.type.toLowerCase().includes('int') ? 1 : 'x';
	}
	const names = Object.keys(row);
	db.prepare(
		`INSERT INTO \`${table}\` (${names.map((n) => `\`${n}\``).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`
	).run(...Object.values(row));
}

describe('the migration that adds moderation rules', () => {
	it('keeps every row that existed before it, the comments with their replies included', () => {
		expect(RULES).toBeDefined();
		const db = new DatabaseSync(':memory:');
		db.exec('PRAGMA foreign_keys = ON');
		for (const file of migrations.filter((f) => f < (RULES as string))) apply(db, file);

		insert(db, 'user', { id: 'u1', email: 'u1@example.com', role: 'moderator' });
		insert(db, 'user', { id: 'u2', email: 'u2@example.com' });
		insert(db, 'titles', { id: 't1', kind: 'movie', tmdb_id: 348 });
		insert(db, 'comments', { id: 'c1', title_id: 't1', user_id: 'u2', body: 'parent' });
		insert(db, 'comments', {
			id: 'c2',
			title_id: 't1',
			user_id: 'u2',
			body: 'reply',
			parent_id: 'c1',
			root_id: 'c1'
		});
		insert(db, 'moderation_actions', {
			id: 'a1',
			actor_id: 'u1',
			target_comment_id: 'c1',
			action: 'hide',
			reason: 'noted'
		});
		insert(db, 'moderation_actions', {
			id: 'a2',
			actor_id: 'u1',
			target_user_id: 'u2',
			action: 'mute',
			mute_hours: 24
		});

		apply(db, RULES as string);

		const log = db
			.prepare('SELECT id, action, reason, mute_hours, rule FROM moderation_actions ORDER BY id')
			.all();
		expect(log).toEqual([
			{ id: 'a1', action: 'hide', reason: 'noted', mute_hours: null, rule: null },
			{ id: 'a2', action: 'mute', reason: null, mute_hours: 24, rule: null }
		]);
		const kept = db
			.prepare('SELECT id, parent_id, body, moderation_rule FROM comments ORDER BY id')
			.all();
		expect(kept).toEqual([
			{ id: 'c1', parent_id: null, body: 'parent', moderation_rule: null },
			{ id: 'c2', parent_id: 'c1', body: 'reply', moderation_rule: null }
		]);
		expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
		db.close();
	});
});
