/** An ISO timestamp for a mute that has not ended, else null. */
export function activeMute(mutedUntil: Date | null): string | null {
	return mutedUntil && mutedUntil.getTime() > Date.now() ? mutedUntil.toISOString() : null;
}
