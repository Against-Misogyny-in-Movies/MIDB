import { FEMINIST_ICONS, GENERATED_DIGITS } from '#lib/media/utils/feminist-icons.ts';

/** How many names are tried before a sign-up fails. */
export const USERNAME_ATTEMPTS = 8;

/** A random integer below `max` from `crypto.getRandomValues`, without modulo bias. */
function randomBelow(max: number): number {
	const limit = Math.floor(0x1_0000_0000 / max) * max;
	const buf = new Uint32Array(1);
	do crypto.getRandomValues(buf);
	while (buf[0] >= limit);
	return buf[0] % max;
}

/** One candidate: a random icon, `_`, and four random digits (`audre_lorde_0427`). */
export function randomUsername(): string {
	const icon = FEMINIST_ICONS[randomBelow(FEMINIST_ICONS.length)];
	const digits = String(randomBelow(10 ** GENERATED_DIGITS)).padStart(GENERATED_DIGITS, '0');
	return `${icon}_${digits}`;
}

/**
 * A username no account has, for a new account. It draws a candidate, asks `isTaken` (in
 * production the rename check: look-alikes and recently retired names count) and draws again on a collision, up to
 * `USERNAME_ATTEMPTS` times, then throws so the sign-up fails instead of storing a duplicate.
 */
export async function generateUsername(
	isTaken: (username: string) => Promise<boolean>
): Promise<string> {
	for (let attempt = 0; attempt < USERNAME_ATTEMPTS; attempt++) {
		const candidate = randomUsername();
		if (!(await isTaken(candidate))) return candidate;
	}
	throw new Error(`No free username after ${USERNAME_ATTEMPTS} attempts.`);
}
