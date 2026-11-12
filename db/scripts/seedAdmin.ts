import { sql } from 'drizzle-orm';
import { users } from '../schema/auth.ts';
import { openScriptDb } from './lib/db.ts';
import { parseTarget } from './lib/args.ts';
import { parseAdminArgs, ADMIN_USAGE } from './lib/adminArgs.ts';
import { isMain } from '../../scripts/lib/is-main.ts';

if (isMain(import.meta.url)) {
	const args = parseAdminArgs(process.argv.slice(2));
	if (!args) {
		console.error(ADMIN_USAGE);
		process.exit(1);
	}

	const { db, close } = await openScriptDb(parseTarget(process.argv.slice(2)));
	try {
		const match =
			args.by === 'email'
				? sql`lower(${users.email}) = lower(${args.value})`
				: sql`lower(${users.username}) = lower(${args.value})`;
		const result = await db
			.update(users)
			.set({ role: 'administrator' })
			.where(match)
			.returning({ id: users.id });

		if (result.length === 0) {
			console.log('No row matched: the user must sign in first.');
		} else {
			console.log(`Promoted ${args.value} to administrator.`);
		}
	} finally {
		await close();
	}
}
