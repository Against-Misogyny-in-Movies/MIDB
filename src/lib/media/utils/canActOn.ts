/**
 * Whether a moderator can mute, ban or reject the reports of an account. An administrator acts
 * on moderators too; nobody acts on an administrator or on themselves
 * (`targetAllowed`, `docs/architecture.md`, Comments). The server decides; this only hides
 * the controls that would be refused.
 */
export function canActOn(
	me: { id: string; role: string },
	target: { id: string; role: string }
): boolean {
	return (
		target.id !== me.id &&
		target.role !== 'administrator' &&
		(target.role !== 'moderator' || me.role === 'administrator')
	);
}
