export const ADMIN_USAGE =
	'Usage: pnpm db:seed:admin (--username <name> | --email <addr>) [--local | --remote]';

export interface AdminArgs {
	by: 'username' | 'email';
	value: string;
}

/** The user to promote: exactly one of `--username` or `--email`, each with a value. */
export function parseAdminArgs(argv: readonly string[]): AdminArgs | null {
	const found: AdminArgs[] = [];
	for (const flag of ['username', 'email'] as const) {
		const i = argv.indexOf(`--${flag}`);
		if (i === -1) continue;
		const value = argv[i + 1];
		if (!value || value.startsWith('--')) return null;
		found.push({ by: flag, value });
	}
	return found.length === 1 ? found[0] : null;
}
