import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { purgeProfiles, purgeTitleComments } from '#lib/server/http/purge-title.ts';
import {
	authorizeWrite,
	commentIdParam,
	editSchema,
	privateJson,
	readBody
} from '#lib/server/http/comment-request.ts';
import {
	editComment,
	getCommentThread,
	softDeleteComment
} from '#lib/server/data/comment-queries.ts';
import { rateLimit } from '#lib/server/http/rate-limit.ts';

function refuse(
	reason: 'not-found' | 'forbidden' | 'not-editable' | 'parent-not-found' | 'conflict'
): never {
	if (reason === 'forbidden') error(403, 'Only the author can change a comment');
	if (reason === 'conflict') error(409, 'This comment changed. Reload it and try again.');
	if (reason === 'not-editable') error(409, 'This comment can no longer be edited');
	error(404, 'Comment not found');
}

/**
 * The thread of one comment, for a link to it. A published comment is public; any other status
 * is the author's and staff's, so the response reads the user and is `PRIVATE_NO_STORE`. The
 * limit keys on the IP, for signed-in readers too, because the route is open to anyone.
 */
export const GET: RequestHandler = async (event) => {
	const id = commentIdParam(event.params.id);
	await rateLimit(event, 'RL_COMMENT_READ');
	const thread = await getCommentThread(id, await event.locals.getUser());
	if (!thread) error(404, 'Comment not found');
	return privateJson(thread);
};

/** The author edits a comment; moderation runs again on the new body. */
export const PATCH: RequestHandler = async (event) => {
	const id = commentIdParam(event.params.id);
	const user = await authorizeWrite(event, 'RL_COMMENT');
	const { body } = await readBody(event.request, editSchema);

	const result = await editComment(id, user.id, body);
	if (!result.ok) refuse(result.reason);
	purgeTitleComments(result.title);
	purgeProfiles([user.id, ...(result.replyAuthorIds ?? [])]);
	return privateJson({ comment: result.comment });
};

/** The author deletes a comment; it stays as a placeholder while it has published replies. */
export const DELETE: RequestHandler = async (event) => {
	const id = commentIdParam(event.params.id);
	const user = await authorizeWrite(event, 'RL_COMMENT');

	const result = await softDeleteComment(id, user.id);
	if (!result.ok) refuse(result.reason);
	purgeTitleComments(result.title);
	purgeProfiles([user.id, ...result.replyAuthorIds]);
	return privateJson({ ok: true });
};
