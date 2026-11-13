import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PRIVATE_NO_STORE, communityReportsHeaders } from '#lib/server/http/cache.ts';
import { purgeProfile, purgeTitleReports } from '#lib/server/http/purge-title.ts';
import { authorizeWrite, privateJson, readBody } from '#lib/server/http/comment-request.ts';
import { answersOf, reportSchema } from '#lib/server/http/community-report-request.ts';
import {
	deleteReport,
	getReportCounts,
	ReportAnswersError,
	upsertReport
} from '#lib/server/data/community-reports.ts';
import {
	findCommentTitle,
	parseTitleParams,
	resolveWriteRef
} from '#lib/server/data/comment-title.ts';
import { COMMUNITY_REPORT_MIN } from '#lib/media/utils/communityReports.ts';
import type { CommunityReportsResponse } from '#lib/media/types/community-reports.ts';

/**
 * A title's community-report counts: `PUBLIC_COMMUNITY_REPORTS` with the title's `Cache-Tag`, the same
 * for every reader. It never reads the user, and sets no cookie. Below `COMMUNITY_REPORT_MIN`
 * counted reports it answers the total only. A title nobody reported has no row and answers a
 * zero total (a GET writes nothing).
 */
export const GET: RequestHandler = async ({ params }) => {
	const { kind, tmdbId } = parseTitleParams(params.kind, params.tmdbId);
	const title = await findCommentTitle(kind, tmdbId);
	const counts = title ? await getReportCounts(title.id) : null;
	const body: CommunityReportsResponse =
		counts && counts.total >= COMMUNITY_REPORT_MIN ? counts : { total: counts?.total ?? 0 };
	return Response.json(body, { headers: communityReportsHeaders(kind, tmdbId) });
};

/**
 * Stores or replaces the reader's report and answers its status and hold reason (200). A
 * contradictory body is a 400. Purges the title's counts and the reader's profile.
 */
export const PUT: RequestHandler = async (event) => {
	const { kind, tmdbId } = parseTitleParams(event.params.kind, event.params.tmdbId);
	const user = await authorizeWrite(event, 'RL_CONTENT_REPORT');
	const answers = answersOf(await readBody(event.request, reportSchema));

	const ref = await resolveWriteRef(kind, tmdbId);
	let result: Awaited<ReturnType<typeof upsertReport>>;
	try {
		result = await upsertReport(user, kind, ref, answers);
	} catch (err) {
		if (err instanceof ReportAnswersError) error(400, 'Invalid request');
		throw err;
	}

	purgeTitleReports({ kind, tmdbId });
	purgeProfile(user.id);
	return privateJson({ status: result.status, holdReason: result.holdReason });
};

/** Withdraws the reader's report (204, also when there was none). Purges the title's counts and the reader's profile when one existed. */
export const DELETE: RequestHandler = async (event) => {
	const { kind, tmdbId } = parseTitleParams(event.params.kind, event.params.tmdbId);
	const user = await authorizeWrite(event, 'RL_CONTENT_REPORT');

	const title = await findCommentTitle(kind, tmdbId);
	if (title && (await deleteReport(user.id, title.id))) {
		purgeTitleReports({ kind, tmdbId });
		purgeProfile(user.id);
	}
	return new Response(null, { status: 204, headers: PRIVATE_NO_STORE });
};
