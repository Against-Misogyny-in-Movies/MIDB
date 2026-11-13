import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/auth/guards.ts';
import { privateJson } from '#lib/server/http/comment-request.ts';
import { getViewerReport, type ViewerReport } from '#lib/server/data/community-reports.ts';
import { activeMute } from '#lib/server/data/mute.ts';
import { findCommentTitle, parseTitleParams } from '#lib/server/data/comment-title.ts';
import type { ViewerReportResponse, ViewerReportView } from '#lib/media/types/community-reports.ts';

/** The report with its dates as the ISO strings the JSON carries. */
const toView = (report: ViewerReport): ViewerReportView => ({
	...report,
	createdAt: report.createdAt.toISOString(),
	updatedAt: report.updatedAt.toISOString(),
	countsFrom: report.countsFrom.toISOString()
});

/** The signed-in reader's own report of a title and its status: `PRIVATE_NO_STORE`. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { kind, tmdbId } = parseTitleParams(params.kind, params.tmdbId);
	const user = await requireUser(locals);
	const title = await findCommentTitle(kind, tmdbId);
	const report = title ? await getViewerReport(user.id, title.id) : null;
	const body: ViewerReportResponse = {
		report: report && toView(report),
		mutedUntil: activeMute(user.mutedUntil)
	};
	return privateJson(body);
};
