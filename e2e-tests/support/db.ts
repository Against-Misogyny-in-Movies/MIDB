import { execFileSync } from 'node:child_process';

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
