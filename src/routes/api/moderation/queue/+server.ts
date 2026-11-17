import { error } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireRole } from '#lib/server/auth/guards.ts';
import { PRIVATE_NO_STORE } from '#lib/server/http/cache.ts';
import { listFlaggedTitles, listHeldReports } from '#lib/server/data/community-report-queue.ts';
import {
	listPendingQueue,
	listRecentActions,
	listReportedQueue
} from '#lib/server/data/moderation-queue.ts';
import {
	QUEUE_SHAPES,
	decodeQueueCursor,
	type QueueName,
	type QueuePage
} from '#lib/server/data/queue-cursor.ts';
import { STAFF_ROLES } from '#lib/media/utils/staff.ts';

const query = z.object({
	queue: z.enum(['pending', 'reported', 'held', 'flagged', 'log']),
	cursor: z
		.string()
		.max(200)
		.regex(/^[\w-]+$/)
});

const lists: Record<QueueName, (cursor: string) => Promise<QueuePage<unknown>>> = {
	pending: listPendingQueue,
	reported: listReportedQueue,
	held: listHeldReports,
	flagged: listFlaggedTitles,
	log: listRecentActions
};

/**
 * A further page of a moderation list for its "Show more" control: `?queue=` is `pending`,
 * `reported`, `held`, `flagged` or `log`, and `cursor` is the one the previous page answered
 * (`QueuePage`). Staff only (401 signed out, 403 otherwise) and `private, no-store`. Staff are
 * not rate-limited, like the page's own load and actions. A missing queue, or a cursor that list
 * did not make, is 400.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	await requireRole(locals, STAFF_ROLES);
	const parsed = query.safeParse({
		queue: url.searchParams.get('queue'),
		cursor: url.searchParams.get('cursor')
	});
	if (!parsed.success || !decodeQueueCursor(parsed.data.cursor, QUEUE_SHAPES[parsed.data.queue])) {
		error(400, 'Invalid request');
	}
	const page = await lists[parsed.data.queue](parsed.data.cursor);
	return Response.json(page, { headers: PRIVATE_NO_STORE });
};
