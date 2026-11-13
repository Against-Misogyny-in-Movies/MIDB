/** The roles that moderate (`db/schema/auth.ts`, `userRole`); the one list the guards and the report rules read. */
export const STAFF_ROLES = ['moderator', 'administrator'] as const;

/** Whether an account's role is a staff role. */
export function isStaff(role: string): boolean {
	return (STAFF_ROLES as readonly string[]).includes(role);
}
