import type { users } from '#db/schema/auth.ts';

/** Insert values for a test user: Better Auth's required `name` and `email` filled in. */
export function userValues(
	id: string,
	overrides: Partial<typeof users.$inferInsert> = {}
): typeof users.$inferInsert {
	return { id, name: id, email: `${id}@example.com`, ...overrides };
}
