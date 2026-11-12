/** Where a reader lands after signing in when no page sent them. */
export const DEFAULT_RETURN_PATH = '/user/profile';

/** A stand-in origin to resolve the value against; a path that resolves elsewhere is refused. */
const BASE = 'http://return-path.invalid';

function hasControlCharacter(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code < 0x20 || code === 0x7f) return true;
	}
	return false;
}

/**
 * The path a sign-in returns to: only a same-origin path that starts with a single `/`. Anything
 * else (an absolute URL, `//host`, a backslash form, a control character, `/auth` itself, which
 * would loop) gives `fallback`. The value is resolved by URL parsing, so a form the browser reads
 * as another host (`/\t/host`) is caught, and the result is the parsed path, never the raw text.
 */
export function safeReturnPath(
	value: string | null | undefined,
	fallback: string = DEFAULT_RETURN_PATH
): string {
	if (!value || value.length > 2048 || !value.startsWith('/') || value.startsWith('//')) {
		return fallback;
	}
	if (value.includes('\\') || hasControlCharacter(value)) return fallback;
	let url: URL;
	try {
		url = new URL(value, BASE);
	} catch {
		return fallback;
	}
	if (url.origin !== BASE) return fallback;
	// Dot segments can collapse a path into `//host`, which a browser reads as another origin.
	if (url.pathname.startsWith('//')) return fallback;
	if (url.pathname === '/auth' || url.pathname.startsWith('/auth/')) return fallback;
	return `${url.pathname}${url.search}${url.hash}`;
}
