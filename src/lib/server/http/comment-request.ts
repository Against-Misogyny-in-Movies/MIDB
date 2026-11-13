import { error, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { requireUser } from '#lib/server/auth/guards.ts';
import { rateLimit, type RateLimitBucket } from '#lib/server/http/rate-limit.ts';
import { PRIVATE_NO_STORE } from '#lib/server/http/cache.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import { isStaff } from '#lib/media/utils/staff.ts';
import { COMMENT_BODY_MAX, REPORT_NOTE_MAX, reportReason } from '#lib/media/utils/comments.ts';

type WriteEvent = Pick<RequestEvent, 'locals' | 'request' | 'getClientAddress'>;

/**
 * The first three steps of every comment write, in order: the guard (401; a banned account is
 * signed out, because `locals.getUser` reads the row on each request and resolves a banned user
 * to none), the mute check on that fresh row (403), then the rate limit (429), which
 * `staffExempt` skips for a moderator or administrator (the community-report writes only). It returns the
 * user; the caller then reads and validates the body, so a refused or throttled request never costs a parse. Call it
 * outside any `try`.
 */
export async function authorizeWrite(
	event: WriteEvent,
	bucket: RateLimitBucket,
	options: { staffExempt?: boolean } = {}
): Promise<UserRow> {
	const user = await requireUser(event.locals);
	if (user.mutedUntil && user.mutedUntil.getTime() > Date.now()) error(403, 'Account muted');
	if (!(options.staffExempt && isStaff(user.role)))
		await rateLimit(event, bucket, { userId: user.id });
	return user;
}

/** Reads the JSON body and validates it, answering 400 on malformed JSON or a failed schema. */
export async function readBody<S extends z.ZodType>(
	request: Request,
	schema: S
): Promise<z.infer<S>> {
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		error(400, 'Invalid JSON');
	}
	const parsed = schema.safeParse(json);
	if (!parsed.success) error(400, 'Invalid request');
	return parsed.data;
}

const idSchema = z.string().regex(/^[\w-]{1,64}$/);

/** A comment id from the path; anything else is a 404, as no such comment can exist. */
export function commentIdParam(value: string): string {
	const parsed = idSchema.safeParse(value);
	if (!parsed.success) error(404, 'Comment not found');
	return parsed.data;
}

const body = z.string().trim().min(1).max(COMMENT_BODY_MAX);

export const createSchema = z.object({ body, parentId: idSchema.nullish() });
export const editSchema = z.object({ body });
export const voteSchema = z.object({ value: z.union([z.literal(1), z.literal(-1)]) });
export const reportSchema = z.object({
	reason: z.enum(reportReason),
	note: z.string().trim().max(REPORT_NOTE_MAX).nullish()
});

/** A JSON response for one reader: never stored by a browser or the edge. */
export function privateJson(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: PRIVATE_NO_STORE });
}
