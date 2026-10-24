import { sql } from 'drizzle-orm';
import { users } from '../schema/auth';
import { db, closeDb } from './lib/db';

const email = process.argv[2];
if (!email) {
	console.error('Usage: bun run db:seed:admin <email>');
	process.exit(1);
}

try {
	const result = await db
		.update(users)
		.set({ role: 'administrator' })
		.where(sql`lower(${users.email}) = lower(${email})`)
		.returning({ email: users.email });

	if (result.length === 0) {
		console.log('No row matched — user must sign in first.');
	} else {
		console.log(`Promoted ${result[0].email} to administrator.`);
	}
} finally {
	await closeDb();
}
