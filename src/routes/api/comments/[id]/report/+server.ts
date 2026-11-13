import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { purgeProfiles, purgeTitleComments } from '#lib/server/http/purge-title.ts';
import {
	authorizeWrite,
	commentIdParam,
	privateJson,
	readBody,
	reportSchema
} from '#lib/server/http/comment-request.ts';
import { reportComment } from '#lib/server/data/comment-reports.ts';

/**
 * Reports a published comment. The third distinct open report sends it back to review, which
 * removes it from the public list and from its author's profile, so that report purges both.
 */
export const POST: RequestHandler = async (event) => {
	const id = commentIdParam(event.params.id);
	const user = await authorizeWrite(event, 'RL_REPORT');
	const { reason, note } = await readBody(event.request, reportSchema);

	const result = await reportComment({ commentId: id, reporterId: user.id, reason, note });
	if (!result.ok) {
		if (result.reason === 'own-comment') error(403, 'A comment cannot be reported by its author');
		error(404, 'Comment not found');
	}
	if (result.status !== 'published') {
		purgeTitleComments(result.title);
		purgeProfiles([result.authorId, ...result.replyAuthorIds]);
	}
	return privateJson(
		{ alreadyReported: result.alreadyReported },
		result.alreadyReported ? 200 : 201
	);
};
