import {
	purgeProfiles,
	purgeTitlesComments,
	purgeTitlesReports,
	type PurgeTitle
} from '#lib/server/http/purge-title.ts';
import type { Outcome } from '#lib/server/http/moderation-action.ts';
import { reportedTitlesOf, titlesById } from '#lib/server/data/community-report-moderation.ts';

/**
 * What an account or report action changed that the edge caches show. A data function returns it
 * with its result and writes no cache purge itself; `purgeOutcome` purges it once the write has
 * committed.
 */
export type PurgePlan = {
	/** Titles whose comment lists changed. */
	commentTitles?: PurgeTitle[];
	/** Titles whose community-report counts changed. */
	reportTitles?: PurgeTitle[];
	/** Accounts whose public profile changed. */
	profiles?: string[];
	/**
	 * The counts of titles that are read after the purges above, because the read can fail and
	 * the profiles must be purged first (`docs/architecture.md`, Public profiles): every title
	 * the account reported (`reportedBy`), or the titles with these ids (`reportTitleIds`).
	 */
	reportedBy?: string;
	reportTitleIds?: string[];
};

/** Purges a plan: the titles' lists and counts and the profiles first, then the counts it reads. */
export async function purgePlan(plan: PurgePlan): Promise<void> {
	if (plan.commentTitles?.length) purgeTitlesComments(plan.commentTitles);
	if (plan.reportTitles?.length) purgeTitlesReports(plan.reportTitles);
	if (plan.profiles?.length) purgeProfiles(plan.profiles);
	if (plan.reportedBy) purgeTitlesReports(await reportedTitlesOf(plan.reportedBy));
	if (plan.reportTitleIds?.length) purgeTitlesReports(await titlesById(plan.reportTitleIds));
}

/**
 * The one place the moderation actions purge the edge caches, after the write has committed
 * (`act`'s `after` step; the bulk operation purges through `purgePlan` in its `finally`). A
 * comment action's result names its title, its author and the authors of its published replies;
 * an account or report action carries a `PurgePlan`. A refused action never reaches it.
 */
export async function purgeOutcome(result: Extract<Outcome, { ok: true }>): Promise<void> {
	const title = 'title' in result ? result.title : null;
	const authorId = 'authorId' in result ? result.authorId : undefined;
	const replyAuthorIds = 'replyAuthorIds' in result ? (result.replyAuthorIds ?? []) : [];
	await purgePlan({
		commentTitles: title ? [title] : [],
		profiles: authorId ? [authorId, ...replyAuthorIds] : []
	});
	if ('purge' in result && result.purge) await purgePlan(result.purge);
}
