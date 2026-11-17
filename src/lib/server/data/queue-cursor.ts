/** A page of a moderation list and where the next one starts; null on the last page. */
export type QueuePage<T> = { items: T[]; nextCursor: string | null };

/** A cursor part is a number (a time or a count) or a text (an id), as its list's `shape` says. */
type Shape = readonly ('n' | 's')[];
type Parts<S extends Shape> = { [K in keyof S]: S[K] extends 'n' ? number : string };

/**
 * The parts of each list's cursor, in its sort order: Pending the last row's `created_at` (ms) and
 * id; Reported its open report count, `created_at` and id; held reports `created_at`, account id
 * and title id; flagged titles the open flag count, the oldest flag's time and the title id; the
 * log `created_at` and id.
 */
export const QUEUE_SHAPES = {
	pending: ['n', 's'],
	reported: ['n', 'n', 's'],
	held: ['n', 's', 's'],
	flagged: ['n', 'n', 's'],
	log: ['n', 's']
} as const satisfies Record<string, Shape>;

export type QueueName = keyof typeof QUEUE_SHAPES;

const MAX_CURSOR = 200;

/** The URL-safe text of a sort key: its parts as a JSON array in base64url. */
export function encodeQueueCursor(parts: readonly (string | number)[]): string {
	return btoa(JSON.stringify(parts)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/**
 * The parts of a cursor this module made for a list of that `shape`, or null for anything else
 * (not base64url, not JSON, the wrong length or part types, a number past the safe integers).
 */
export function decodeQueueCursor<const S extends Shape>(
	cursor: string | null | undefined,
	shape: S
): Parts<S> | null {
	if (!cursor || cursor.length > MAX_CURSOR || !/^[A-Za-z0-9_-]+$/.test(cursor)) return null;
	try {
		const padded = cursor.replaceAll('-', '+').replaceAll('_', '/');
		const parts: unknown = JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)));
		if (!Array.isArray(parts) || parts.length !== shape.length) return null;
		const ok = shape.every((kind, i) =>
			kind === 'n'
				? Number.isSafeInteger(parts[i])
				: typeof parts[i] === 'string' && parts[i] !== ''
		);
		return ok ? (parts as Parts<S>) : null;
	} catch {
		return null;
	}
}

/**
 * Splits the `limit + 1` rows a list fetched into its page and the cursor of the last row on it,
 * so a full last page does not offer a "Show more" that finds nothing.
 */
export function toQueuePage<T>(
	rows: T[],
	limit: number,
	cursorOf: (row: T) => readonly (string | number)[]
): QueuePage<T> {
	const items = rows.slice(0, limit);
	return {
		items,
		nextCursor: rows.length > limit ? encodeQueueCursor(cursorOf(items[items.length - 1])) : null
	};
}
