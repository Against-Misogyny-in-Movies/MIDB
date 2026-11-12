import { COMMENT_BODY_MAX, REPORT_NOTE_MAX } from '#lib/media/utils/comments.ts';

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** What a request did, as the section words a failure of it. */
export type CommentAction =
	| 'load'
	| 'more'
	| 'viewer'
	| 'create'
	| 'edit'
	| 'delete'
	| 'vote'
	| 'report';

const FAILED: Record<CommentAction, string> = {
	load: 'The comments could not be loaded',
	more: 'More comments could not be loaded',
	viewer: 'This account’s votes and unpublished comments could not be loaded',
	create: 'The comment was not posted',
	edit: 'The edit was not saved',
	delete: 'The comment was not deleted',
	vote: 'The vote was not saved',
	report: 'The report was not sent'
};

/**
 * One sentence for a failed request: what failed, and why when the status says. A muted or
 * banned account is named, since the reader cannot fix that by retrying.
 */
export function describeFailure(action: CommentAction, status: number, message = ''): string {
	const failed = FAILED[action];
	if (status === 0) return `${failed}. The server could not be reached.`;
	if (status === 401) return `${failed}. The session has ended: sign in again.`;
	if (status === 403) {
		if (/banned/i.test(message)) {
			return 'This account is banned and cannot write, edit, delete, vote on or report comments.';
		}
		if (/muted/i.test(message)) {
			return 'This account is muted and cannot write, edit, delete, vote on or report comments until the mute ends.';
		}
		if (action === 'vote') return 'A comment cannot be voted on by its author.';
		if (action === 'report') return 'A comment cannot be reported by its author.';
		return 'Only the author can change a comment.';
	}
	if (status === 404) return `${failed}. The comment or title no longer exists.`;
	if (status === 409) return 'This comment changed or can no longer be edited. Reload the page.';
	if (status === 429) return `${failed}. Too many requests: wait a moment and try again.`;
	if (status === 400) {
		if (action === 'report') return `${failed}. A note is at most ${REPORT_NOTE_MAX} characters.`;
		return `${failed}. A comment is 1 to ${COMMENT_BODY_MAX.toLocaleString('en-US')} characters.`;
	}
	return `${failed}. Try again in a moment.`;
}

export type Reply<T> =
	| { ok: true; status: number; data: T }
	| { ok: false; status: number; message: string };

/**
 * One JSON request to a comment endpoint. A network failure is status 0; a failed response keeps
 * the `message` the endpoint sent (SvelteKit's error body), which names a muted or banned account.
 */
export async function requestJson<T>(
	fetcher: Fetcher,
	method: string,
	url: string,
	body?: unknown
): Promise<Reply<T>> {
	try {
		const res = await fetcher(url, {
			method,
			...(body === undefined
				? {}
				: { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
		});
		if (res.ok) return { ok: true, status: res.status, data: (await res.json()) as T };
		let message = '';
		try {
			const failure: { message?: string } = await res.json();
			message = failure.message ?? '';
		} catch {
			// A non-JSON error body (a proxy page) carries no message; the status still says what failed.
		}
		return { ok: false, status: res.status, message };
	} catch {
		return { ok: false, status: 0, message: '' };
	}
}
