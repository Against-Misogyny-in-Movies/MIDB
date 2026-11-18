import type { EditedAt } from '#lib/server/data/comment-status.ts';
import {
	approveComment,
	dismissReports,
	hideComment,
	rejectComment,
	restoreComment,
	type ModerationResult
} from '#lib/server/data/moderation-actions.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import {
	text,
	viewedEditedAt,
	withViewedEditedAt,
	type Outcome
} from '#lib/server/http/moderation-action.ts';
import { pageIds, reasonOf, ruleOf } from './action-form.ts';
import type { ModerationRule } from '#lib/media/types/comments.ts';
import { purgePlan } from './purge.ts';

/** What a bulk operation reads for one comment: the reason, and the `editedAt` its row showed. */
type BulkInput = {
	reason: string | null;
	/** The rule a hide or a reject names; the other operations take none. */
	rule: ModerationRule | null;
	editedAt: EditedAt | undefined;
};

/**
 * The five operations a bulk action applies to each comment, by the single-comment functions.
 * The operations that publish need the row's `editedAt` (`withViewedEditedAt`); a row without one
 * is refused.
 */
const BULK_OPS = {
	approve: (staff, id, { editedAt }) =>
		withViewedEditedAt(editedAt, (viewed) => approveComment(staff, id, viewed)),
	hide: (staff, id, { reason, rule }) => hideComment(staff, id, reason, rule),
	reject: (staff, id, { reason, rule }) => rejectComment(staff, id, reason, rule),
	restore: (staff, id, { editedAt }) =>
		withViewedEditedAt(editedAt, (viewed) => restoreComment(staff, id, viewed)),
	dismiss: (staff, id, { editedAt }) =>
		withViewedEditedAt(editedAt, (viewed) => dismissReports(staff, id, viewed))
} satisfies Record<
	string,
	(
		staff: UserRow,
		id: string,
		input: BulkInput
	) => Promise<ModerationResult | { ok: false; reason: 'invalid' }>
>;

const isBulkOp = (op: string | null): op is keyof typeof BULK_OPS =>
	op !== null && Object.hasOwn(BULK_OPS, op);

/**
 * Applies one operation to each comment in turn. The result counts the comments applied, refused
 * and, of those refused, edited since the page loaded. Each function checks the comment's state
 * and the author's standing itself, so a refusal costs only its own comment. Every title touched
 * and every profile (the authors' and those of their published replies) is purged once, however
 * many comments changed, and also when a later write throws: the changes already made are public
 * by then.
 */
export async function runBulk(staff: UserRow, data: FormData): Promise<Outcome> {
	const op = text(data, 'op');
	const ids = pageIds(data);
	if (!isBulkOp(op) || !ids) return { ok: false, reason: 'invalid' };
	const rule = ruleOf(data);
	if ((op === 'hide' || op === 'reject') && rule === null) return { ok: false, reason: 'invalid' };
	const reason = reasonOf(data);
	const touched = new Map<string, NonNullable<Extract<ModerationResult, { ok: true }>['title']>>();
	const authors = new Set<string>();
	let applied = 0;
	let edited = 0;
	try {
		for (const id of ids) {
			const result = await BULK_OPS[op](staff, id, {
				reason,
				rule,
				editedAt: viewedEditedAt(data, `editedAt.${id}`)
			});
			if (!result.ok) {
				if (result.reason === 'edited') edited += 1;
				continue;
			}
			applied += 1;
			if (result.title) touched.set(result.title.id, result.title);
			if (result.authorId) authors.add(result.authorId);
			for (const replyAuthor of result.replyAuthorIds ?? []) authors.add(replyAuthor);
		}
	} finally {
		await purgePlan({ commentTitles: [...touched.values()], profiles: [...authors] });
	}
	if (applied === 0) return { ok: false, reason: 'bulk-unchanged' };
	return { ok: true, extra: { op, applied, refused: ids.length - applied, edited } };
}
