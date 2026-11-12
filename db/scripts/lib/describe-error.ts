import { inspect } from 'node:util';

/**
 * Describes a caught value for a script's log: the error's stack (or message), then one
 * `Caused by:` line per `cause` in the chain. Drizzle wraps a failed query in a
 * `DrizzleQueryError` whose `cause` holds the driver's real reason.
 */
export function describeError(error: unknown): string {
	const lines: string[] = [];
	const seen = new Set<unknown>();
	let current: unknown = error;
	while (current !== undefined && current !== null && !seen.has(current)) {
		seen.add(current);
		const text = current instanceof Error ? (current.stack ?? current.message) : inspect(current);
		lines.push(lines.length === 0 ? text : `Caused by: ${text}`);
		current = current instanceof Error ? current.cause : undefined;
	}
	return lines.join('\n');
}
