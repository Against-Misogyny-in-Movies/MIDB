import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	authorizeWrite,
	commentIdParam,
	privateJson,
	readBody,
	voteSchema
} from '#lib/server/http/comment-request.ts';
import { removeVote, setVote, type VoteResult } from '#lib/server/data/comment-votes.ts';

function answer(result: VoteResult): Response {
	if (result.ok) return privateJson({ score: result.score, vote: result.vote });
	if (result.reason === 'own-comment') error(403, 'A comment cannot be voted on by its author');
	error(404, 'Comment not found');
}

/** Sets the reader's vote (+1 or -1). A vote does not purge the list's edge cache. */
export const PUT: RequestHandler = async (event) => {
	const id = commentIdParam(event.params.id);
	const user = await authorizeWrite(event, 'RL_VOTE');
	const { value } = await readBody(event.request, voteSchema);
	return answer(await setVote(id, user.id, value));
};

/** Removes the reader's vote. */
export const DELETE: RequestHandler = async (event) => {
	const id = commentIdParam(event.params.id);
	const user = await authorizeWrite(event, 'RL_VOTE');
	return answer(await removeVote(id, user.id));
};
