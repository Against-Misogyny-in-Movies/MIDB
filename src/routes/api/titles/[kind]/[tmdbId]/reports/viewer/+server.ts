import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/auth/guards.ts';
import { privateJson } from '#lib/server/http/comment-request.ts';
import { getViewerReport } from '#lib/server/data/reader-reports.ts';
import { activeMute } from '#lib/server/data/mute.ts';
import { findCommentTitle, parseTitleParams } from '#lib/server/data/comment-title.ts';
import type { ViewerReportResponse } from '#lib/media/types/reader-reports.ts';

/** The signed-in reader's own report of a title and its status: `PRIVATE_NO_STORE`. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { kind, tmdbId } = parseTitleParams(params.kind, params.tmdbId);
	const user = await requireUser(locals);
	const title = await findCommentTitle(kind, tmdbId);
	const body: ViewerReportResponse = {
		report: title ? await getViewerReport(user.id, title.id) : null,
		mutedUntil: activeMute(user.mutedUntil)
	};
	return privateJson(body);
};
