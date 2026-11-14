import { execFileSync } from 'node:child_process';
import { REPORT_ACCOUNT_MIN_AGE_DAYS } from '#lib/media/utils/communityReports.ts';
import { DAY_MS } from '#lib/media/utils/time.ts';

/** Runs SQL against the local D1 that `wrangler dev` serves (`.wrangler/state`), and returns its rows. */
export function d1<Row = Record<string, unknown>>(sql: string): Row[] {
	const out = execFileSync(
		'pnpm',
		['exec', 'wrangler', 'd1', 'execute', 'DB', '--local', '--json', '--command', sql],
		{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
	);
	const parsed = JSON.parse(out.slice(out.indexOf('['))) as { results: Row[] }[];
	return parsed.flatMap((statement) => statement.results);
}

/**
 * Inserts a title row, so the comment endpoints find it without calling TMDB. Idempotent on
 * `(kind, tmdb_id)`.
 */
export function seedTitle(kind: 'movie' | 'tv', tmdbId: number, title: string): void {
	const name = title.replace(/'/g, "''");
	d1(
		`INSERT OR IGNORE INTO titles (id, kind, tmdb_id, title, clean_title, created_at, updated_at)
		 VALUES (lower(hex(randomblob(16))), '${kind}', ${tmdbId}, '${name}', lower('${name}'),
		         unixepoch() * 1000, unixepoch() * 1000)`
	);
}

/** Gives the account the moderator role, as `db:seed:admin` does for an administrator. */
export function makeModerator(username: string): void {
	d1(`UPDATE user SET role = 'moderator' WHERE username = '${username.replace(/'/g, "''")}'`);
}

/**
 * Backdates the account's `created_at` (epoch milliseconds) past `REPORT_ACCOUNT_MIN_AGE_DAYS`, so
 * its votes and reports count. A passkey sign-up makes a fresh account that the rule refuses.
 */
export function ageAccount(username: string): void {
	const created = Date.now() - (REPORT_ACCOUNT_MIN_AGE_DAYS + 1) * DAY_MS;
	d1(`UPDATE user SET created_at = ${created} WHERE username = '${username.replace(/'/g, "''")}'`);
}

export interface SeededComment {
	id: string;
	body: string;
	status?: 'published' | 'pending' | 'hidden' | 'rejected' | 'deleted';
	score?: number;
}

/**
 * Inserts root comments by an existing account on a seeded title, in the given status, with no
 * moderation. `removeSeededComments` takes them out again by id prefix.
 */
export function seedComments(
	kind: 'movie' | 'tv',
	tmdbId: number,
	username: string,
	rows: SeededComment[]
): void {
	const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
	for (const { id, body, status = 'published', score = 0 } of rows) {
		d1(
			`INSERT INTO comments (id, title_id, user_id, body, status, score, created_at, updated_at)
			 SELECT ${quote(id)}, titles.id, user.id, ${quote(body)}, '${status}', ${score},
			        unixepoch() * 1000, unixepoch() * 1000
			 FROM titles, user
			 WHERE titles.kind = '${kind}' AND titles.tmdb_id = ${tmdbId} AND user.username = ${quote(username)}`
		);
	}
}

/** Deletes the comments whose id starts with `prefix`. */
export function removeSeededComments(prefix: string): void {
	d1(`DELETE FROM comments WHERE id LIKE '${prefix.replace(/'/g, "''")}%'`);
}
