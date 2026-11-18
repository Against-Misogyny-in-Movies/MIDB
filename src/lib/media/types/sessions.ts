/**
 * One live session of the signed-in account, as `GET /api/me/sessions` returns it. It carries no
 * token and no IP address: `id` is the session row's id, which is not its token.
 */
export interface AccountSession {
	id: string;
	/** The browser and system, such as `Firefox on macOS`. */
	label: string;
	mobile: boolean;
	/** When the session started, an ISO date-time. */
	startedAt: string;
	/** The session that made the request. It is listed first. */
	current: boolean;
}
