import { fail } from '@sveltejs/kit';
import type { Actions } from '@sveltejs/kit';
import { requireRole } from '#lib/server/auth/guards.ts';
import { rateLimit, type RateLimitBucket } from '#lib/server/http/rate-limit.ts';
import type { ModerationResult } from '#lib/server/data/moderation-actions.ts';
import type { ReportModerationResult } from '#lib/server/data/community-report-moderation.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import type { ScanFailure } from '#lib/server/moderation/scan.ts';
import { SCAN_CONCERN_MAX } from '#lib/media/utils/comments.ts';
import { STAFF_ROLES } from '#lib/media/utils/staff.ts';

export type ActionEvent = Parameters<Actions[string]>[0];

/** The text field `name` of the form, trimmed; empty or absent is null, and a file part is not text. */
export function text(data: FormData, name: string): string | null {
	const value = data.get(name);
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Why a request is refused before or instead of a change. */
type Refusal =
	| Extract<ModerationResult | ReportModerationResult, { ok: false }>['reason']
	| ScanFailure
	| 'invalid'
	| 'bulk-unchanged';

/**
 * What an action answers when it is not a data function's result: a refusal, or success with
 * `extra` fields the page reads from `form` (`aiSearch`, `scan` and `bulk` return counts and
 * the filters the model chose).
 */
type ExtraOutcome = { ok: true; extra: Record<string, unknown> } | { ok: false; reason: Refusal };

export type Outcome = ModerationResult | ReportModerationResult | ExtraOutcome;

const AI_FAILED: [number, string] = [
	502,
	'The AI service gave no usable answer, and nothing was saved.'
];

const refusals: Record<Refusal, [number, string]> = {
	invalid: [400, 'The request was not valid.'],
	'not-found': [404, 'The comment, report or account no longer exists.'],
	'invalid-state': [409, 'It is no longer in a state this action applies to.'],
	'forbidden-target': [
		403,
		'A moderator can act only on ordinary accounts, an administrator also on moderators; no one acts on an administrator or on their own account.'
	],
	'bulk-unchanged': [
		409,
		'None of the selected comments could be changed: none is in a status this action applies to.'
	],
	'invalid-concern': [400, `The scan text must be 1 to ${SCAN_CONCERN_MAX} characters.`],
	'ai-unavailable': [503, 'AI search and scan are not set up on this site.'],
	'ai-rate-limited': [429, 'The AI service is busy; a search or scan can run again in a moment.'],
	'ai-refusal': AI_FAILED,
	'ai-truncated': AI_FAILED,
	'ai-unparsed': AI_FAILED,
	'ai-timeout': AI_FAILED,
	'ai-error': AI_FAILED
};

/**
 * One moderator action: the guard (403 for anyone else), the rate limit (`bucket`), then `run`
 * over the form. `key` reads the action's target, and a form without one is refused; `after`
 * runs on success (a comment action purges its title's list there, so the change is public at
 * once). The community-report data functions purge their own counts.
 */
export async function act(
	event: ActionEvent,
	name: string,
	key: (data: FormData) => string | null,
	run: (staff: UserRow, data: FormData) => Promise<Outcome> | Outcome,
	after?: (result: Extract<Outcome, { ok: true }>) => void,
	bucket: RateLimitBucket = 'RL_MODERATE'
) {
	const staff = await requireRole(event.locals, STAFF_ROLES);
	await rateLimit(event, bucket, { userId: staff.id });
	const data = await event.request.formData();
	const target = key(data);
	if (!target) return fail(400, { id: null, error: 'The request had no target.' });

	const result = await run(staff, data);
	if (!result.ok) {
		const [status, message] = refusals[result.reason];
		return fail(status, { id: target, error: message });
	}
	after?.(result);
	return { id: target, done: name, ...('extra' in result ? result.extra : {}) };
}
