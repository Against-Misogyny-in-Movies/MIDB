import { error } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireRole } from '#lib/server/auth/guards.ts';
import { PRIVATE_NO_STORE } from '#lib/server/http/cache.ts';
import { listFlaggedTitles, listHeldReports } from '#lib/server/data/community-report-queue.ts';
import { listPendingQueue, listReportedQueue } from '#lib/server/data/moderation-queue.ts';
import { listRecentActions, type LogFilter } from '#lib/server/data/recent-actions.ts';
import {
	QUEUE_SHAPES,
	decodeQueueCursor,
	type QueueName,
	type QueuePage
} from '#lib/server/data/queue-cursor.ts';
import { logActionsOf } from '#lib/media/utils/moderationLog.ts';
import { STAFF_ROLES } from '#lib/media/utils/staff.ts';

const query = z.object({
	queue: z.enum(['pending', 'reported', 'held', 'flagged', 'log']),
	cursor: z
		.string()
		.max(200)
		.regex(/^[\w-]+$/),
	/** The log only: the account whose actions it lists (`LogFilter`). */
	account: z
		.string()
		.max(64)
		.regex(/^[\w-]+$/)
		.optional(),
	/** The log only: a group or an action (`logActionsOf`), and the staff member's id. */
	action: z
		.string()
		.max(32)
		.refine((value) => logActionsOf(value) !== null)
		.optional(),
	actor: z
		.string()
		.max(64)
		.regex(/^[\w-]+$/)
		.optional()
});

const lists: Record<QueueName, (cursor: string, filter: LogFilter) => Promise<QueuePage<unknown>>> =
	{
		pending: (cursor) => listPendingQueue(cursor),
		reported: (cursor) => listReportedQueue(cursor),
		held: (cursor) => listHeldReports(cursor),
		flagged: (cursor) => listFlaggedTitles(cursor),
		log: (cursor, filter) => listRecentActions(cursor, undefined, filter)
	};

/**
 * A further page of a moderation list for its "Show more" control: `?queue=` is `pending`,
 * `reported`, `held`, `flagged` or `log`, and `cursor` is the one the previous page answered
 * (`QueuePage`). `account`, `actor` (a staff member's id) and `action` (a group or an action, `logActionsOf`) narrow `log`. Staff only (401 signed out, 403 otherwise) and `private, no-store`. Staff are
 * not rate-limited, like the page's own load and actions. A missing queue, or a cursor that list
 * did not make, is 400.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	await requireRole(locals, STAFF_ROLES);
	const parsed = query.safeParse({
		queue: url.searchParams.get('queue'),
		cursor: url.searchParams.get('cursor'),
		account: url.searchParams.get('account') ?? undefined,
		action: url.searchParams.get('action') ?? undefined,
		actor: url.searchParams.get('actor') ?? undefined
	});
	if (!parsed.success || !decodeQueueCursor(parsed.data.cursor, QUEUE_SHAPES[parsed.data.queue])) {
		error(400, 'Invalid request');
	}
	const page = await lists[parsed.data.queue](parsed.data.cursor, {
		accountId: parsed.data.account,
		actorId: parsed.data.actor,
		actions: logActionsOf(parsed.data.action ?? null) ?? undefined
	});
	return Response.json(page, { headers: PRIVATE_NO_STORE });
};
