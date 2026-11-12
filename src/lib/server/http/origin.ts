/** The hostnames a contributor develops on: `localhost` and the loopback addresses. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Whether an origin (a URL) is on this machine. A string that is not a URL is not local. */
export function isLocalOrigin(origin: string): boolean {
	try {
		return LOCAL_HOSTS.has(new URL(origin).hostname);
	} catch {
		return false;
	}
}
