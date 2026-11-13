import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	authorizeWrite,
	commentIdParam,
	privateJson,
	readBody,
	voteSchema
} from '#lib/server/http/comment-request.ts';
import { purgeTitleComments } from '#lib/server/http/purge-title.ts';
import { removeVote, setVote, type VoteResult } from '#lib/server/data/comment-votes.ts';

function answer(result: VoteResult): Response {
	if (result.ok) {
		purgeTitleComments(result.title);
		return privateJson({ score: result.score, vote: result.vote });
	}
	if (result.reason === 'own-comment') error(403, 'A comment cannot be voted on by its author');
	error(404, 'Comment not found');
}

/** Sets the reader's vote (+1 or -1). A vote purges the title's comment list. */
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
