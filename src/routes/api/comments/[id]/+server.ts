import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { purgeTitleComments } from '#lib/server/http/purge-title.ts';
import {
	authorizeWrite,
	commentIdParam,
	editSchema,
	privateJson,
	readBody
} from '#lib/server/http/comment-request.ts';
import { editComment, softDeleteComment } from '#lib/server/data/comment-queries.ts';

function refuse(
	reason: 'not-found' | 'forbidden' | 'not-editable' | 'parent-not-found' | 'conflict'
): never {
	if (reason === 'forbidden') error(403, 'Only the author can change a comment');
	if (reason === 'conflict') error(409, 'This comment changed. Reload it and try again.');
	if (reason === 'not-editable') error(409, 'This comment can no longer be edited');
	error(404, 'Comment not found');
}

/** The author edits a comment; moderation runs again on the new body. */
export const PATCH: RequestHandler = async (event) => {
	const id = commentIdParam(event.params.id);
	const user = await authorizeWrite(event, 'RL_COMMENT');
	const { body } = await readBody(event.request, editSchema);

	const result = await editComment(id, user.id, body);
	if (!result.ok) refuse(result.reason);
	purgeTitleComments(result.title);
	return privateJson({ comment: result.comment });
};

/** The author deletes a comment; it stays as a placeholder while it has published replies. */
export const DELETE: RequestHandler = async (event) => {
	const id = commentIdParam(event.params.id);
	const user = await authorizeWrite(event, 'RL_COMMENT');

	const result = await softDeleteComment(id, user.id);
	if (!result.ok) refuse(result.reason);
	purgeTitleComments(result.title);
	return privateJson({ ok: true });
};
