import type { RequestHandler } from './$types';
import { authorizeWrite, privateJson, readBody } from '#lib/server/http/comment-request.ts';
import { countFlagSchema } from '#lib/server/http/community-report-request.ts';
import { upsertCountFlag } from '#lib/server/data/count-flags.ts';
import { parseTitleParams, resolveCommentTitle } from '#lib/server/data/comment-title.ts';

/**
 * Flags a title's counts as wrong, with an optional note: one flag per account per title, so a
 * second call replaces the note and re-opens it (200). It does not change the counts or purge.
 */
export const POST: RequestHandler = async (event) => {
	const { kind, tmdbId } = parseTitleParams(event.params.kind, event.params.tmdbId);
	const user = await authorizeWrite(event, 'RL_REPORT');
	const { note } = await readBody(event.request, countFlagSchema);

	const title = await resolveCommentTitle(kind, tmdbId);
	await upsertCountFlag(title.id, user.id, note);
	return privateJson({ flagged: true });
};
