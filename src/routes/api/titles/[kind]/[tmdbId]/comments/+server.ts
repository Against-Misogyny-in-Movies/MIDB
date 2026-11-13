import { error } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { commentsHeaders } from '#lib/server/http/cache.ts';
import { purgeProfile, purgeTitleComments } from '#lib/server/http/purge-title.ts';
import {
	authorizeWrite,
	createSchema,
	privateJson,
	readBody
} from '#lib/server/http/comment-request.ts';
import { createComment, listTitleComments } from '#lib/server/data/comment-queries.ts';
import {
	findCommentTitle,
	parseTitleParams,
	resolveCommentTitle
} from '#lib/server/data/comment-title.ts';

const listQuery = z.object({
	sort: z.enum(['top', 'new']).default('top'),
	cursor: z.string().max(100).nullish()
});

/**
 * A title's published comments: `PUBLIC_COMMENTS` with the title's `Cache-Tag`, the same for
 * every reader. It never reads the user, and sets no cookie. A title nobody commented on has no
 * row yet and answers an empty list (a GET writes nothing).
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const { kind, tmdbId } = parseTitleParams(params.kind, params.tmdbId);
	const query = listQuery.safeParse({
		sort: url.searchParams.get('sort') ?? undefined,
		cursor: url.searchParams.get('cursor')
	});
	if (!query.success) error(400, 'Invalid request');

	const title = await findCommentTitle(kind, tmdbId);
	const list = title
		? await listTitleComments(title.id, query.data)
		: { comments: [], nextCursor: null };
	return Response.json(list, { headers: commentsHeaders(kind, tmdbId) });
};

/**
 * Stores a comment or a reply and answers it with its status (201). Purges the title's list and
 * the author's profile.
 */
export const POST: RequestHandler = async (event) => {
	const { kind, tmdbId } = parseTitleParams(event.params.kind, event.params.tmdbId);
	const user = await authorizeWrite(event, 'RL_COMMENT');
	const { body, parentId } = await readBody(event.request, createSchema);

	const title = await resolveCommentTitle(kind, tmdbId);
	const result = await createComment({ title, userId: user.id, body, parentId });
	if (!result.ok) error(404, 'The comment to answer was not found');

	purgeTitleComments({ kind, tmdbId });
	purgeProfile(user.id);
	return privateJson({ comment: result.comment }, 201);
};
