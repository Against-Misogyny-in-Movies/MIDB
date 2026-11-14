/**
 * The security headers every response carries. The request hook sets them on what it returns;
 * the `_headers` file in the project root (`docs/architecture.md`, Caching policy) sets the same
 * on the files Workers Assets serves, which never reach the hook, and a test keeps the two equal.
 */
export const SECURITY_HEADERS = {
	'strict-transport-security': 'max-age=63072000; includeSubDomains',
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'x-frame-options': 'DENY',
	'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
	'cross-origin-opener-policy': 'same-origin'
};
