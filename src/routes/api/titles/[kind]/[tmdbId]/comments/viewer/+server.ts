import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/auth/guards.ts';
import { privateJson } from '#lib/server/http/comment-request.ts';
import { getViewerCommentState } from '#lib/server/data/comment-queries.ts';
import { votesOpenAt } from '#lib/server/data/counting-account.ts';
import { activeMute } from '#lib/server/data/mute.ts';
import { findCommentTitle } from '#lib/server/data/comment-title.ts';
import { parseTitleParams } from '#lib/server/titles/title-params.ts';

/** The signed-in reader's votes and unpublished comments on a title: `PRIVATE_NO_STORE`. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { kind, tmdbId } = parseTitleParams(params.kind, params.tmdbId);
	const user = await requireUser(locals);
	const title = await findCommentTitle(kind, tmdbId);
	return privateJson(
		title
			? await getViewerCommentState(title.id, user)
			: {
					votes: {},
					scores: {},
					comments: [],
					mutedUntil: activeMute(user.mutedUntil),
					votesOpenAt: votesOpenAt(user)
				}
	);
};
