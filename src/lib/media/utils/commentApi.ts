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

/** The sentences an action words for the statuses that differ between actions. */
export type StatusWording = {
	/** A 403, whole. */
	forbidden: string;
	/** A 400, whole. */
	badRequest: string;
	/** A 404, whole; without it a 404 reads as an unknown failure. */
	notFound?: string;
	/** A 409, whole; without it a 409 reads as an unknown failure. */
	conflict?: string;
};

/**
 * One sentence for a failed request, from its status: `failed` says what failed, `wording` the
 * statuses that differ between actions. The sequence is shared by the comments and the community reports.
 */
export function describeStatus(failed: string, status: number, wording: StatusWording): string {
	if (status === 0) return `${failed}. The server could not be reached.`;
	if (status === 401) return `${failed}. The session has ended: sign in again.`;
	if (status === 403) return wording.forbidden;
	if (status === 404 && wording.notFound) return wording.notFound;
	if (status === 409 && wording.conflict) return wording.conflict;
	if (status === 429) return `${failed}. Too many requests: wait a moment and try again.`;
	if (status === 400) return wording.badRequest;
	return `${failed}. Try again in a moment.`;
}

/**
 * One sentence for a failed comment request: what failed, and why when the status says. A muted
 * or banned account is named, since the reader cannot fix that by retrying.
 */
export function describeFailure(action: CommentAction, status: number, message = ''): string {
	const failed = FAILED[action];
	let forbidden = 'Only the author can change a comment.';
	if (/banned/i.test(message)) {
		forbidden =
			'This account is banned and cannot write, edit, delete, vote on or report comments.';
	} else if (/muted/i.test(message)) {
		forbidden =
			'This account is muted and cannot write, edit, delete, vote on or report comments until the mute ends.';
	} else if (action === 'vote') forbidden = 'A comment cannot be voted on by its author.';
	else if (action === 'report') forbidden = 'A comment cannot be reported by its author.';
	return describeStatus(failed, status, {
		forbidden,
		badRequest:
			action === 'report'
				? `${failed}. A note is at most ${REPORT_NOTE_MAX} characters.`
				: `${failed}. A comment is 1 to ${COMMENT_BODY_MAX.toLocaleString('en-US')} characters.`,
		notFound: `${failed}. The comment or title no longer exists.`,
		conflict: 'This comment changed or can no longer be edited. Reload the page.'
	});
}

export type Reply<T> =
	| { ok: true; status: number; data: T }
	| { ok: false; status: number; message: string };

/**
 * One JSON request to a comment or community report endpoint. A network failure is status 0; a
 * failed response keeps the `message` the endpoint sent (SvelteKit's error body), which names a
 * muted or banned account. A 204 has no body, so its `data` is undefined.
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
		if (res.ok) {
			const data = res.status === 204 ? undefined : await res.json();
			return { ok: true, status: res.status, data: data as T };
		}
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
