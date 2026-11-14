/**
 * What an actor does to an account: `moderate` acts on its comments, reports and flags;
 * `restrict` mutes or bans it.
 */
export type TargetAction = 'moderate' | 'restrict';

/**
 * Whether a staff member may act on an account. An administrator may act on any account,
 * administrators and themselves included, except that they cannot mute or ban themselves. A
 * moderator may act on an ordinary account only: not on themselves, an administrator or another
 * moderator. The server decides (`targetAllowed`, `docs/architecture.md`, Comments); this is the
 * one rule it and the pages share, so a control the server would refuse stays hidden.
 */
export function canActOn(
	me: { id: string; role: string },
	target: { id: string; role: string },
	action: TargetAction = 'moderate'
): boolean {
	if (me.role === 'administrator') return !(action === 'restrict' && target.id === me.id);
	return target.id !== me.id && target.role === 'user';
}

/**
 * Whether a staff member may close a "Counts look wrong" flag raised by `reporter`. An
 * administrator may close any flag; a moderator any but their own and an administrator's. The server decides
 * (`closeFlag`, `docs/architecture.md`, Comments), and the flag list hides the buttons it would
 * refuse.
 */
export function canCloseFlag(
	me: { id: string; role: string },
	reporter: { id: string; role: string }
): boolean {
	return (
		me.role === 'administrator' || (reporter.id !== me.id && reporter.role !== 'administrator')
	);
}
