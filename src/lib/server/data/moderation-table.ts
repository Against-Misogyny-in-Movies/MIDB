import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { and, asc, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { commentAiLabels, commentReports, comments } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import { TABLE_PAGE_SIZE, type TableFilters } from '#lib/media/utils/moderationFilters.ts';
import { toModerationItems, type ModerationItem } from './moderation-queue.ts';

/** What the newest AI scan of a comment found. */
export type AiLabel = {
	concern: string;
	matched: boolean;
	categories: string[];
	severity: number;
	reason: string;
	createdAt: string;
};

/** A moderation row plus what the table adds: the verdict's severity and failure, and the newest scan label. */
export type ModerationTableRow = ModerationItem & {
	/** The verdict's severity, 0 to 3; null when no verdict ran or it failed. */
	severity: number | null;
	/** The failure code when the classifier gave no verdict, otherwise null. */
	aiFailure: string | null;
	latestLabel: AiLabel | null;
};

export type ModerationTable = {
	rows: ModerationTableRow[];
	total: number;
	page: number;
	pageSize: number;
};

/** Escapes `%`, `_` and the escape character, so a typed substring matches literally. */
const likePattern = (value: string) => `%${value.replace(/[\\%_]/g, '\\$&')}%`;

const contains = (column: AnySQLiteColumn, value: string) =>
	sql`${column} LIKE ${likePattern(value)} ESCAPE '\\'`;

const openReports = sql`(SELECT count(*) FROM ${commentReports} WHERE ${commentReports.commentId} = ${comments.id} AND ${commentReports.status} = 'open')`;

/** Comments with a category in the verdict, or in the newest matched scan label. */
function hasCategory(categories: string[]): SQL {
	const list = sql.join(
		categories.map((c) => sql`${c}`),
		sql`, `
	);
	return sql`(
		EXISTS (SELECT 1 FROM json_each(${comments.aiVerdict}, '$.categories') AS v WHERE v.value IN (${list}))
		OR EXISTS (
			SELECT 1 FROM json_each((
				SELECT l.categories FROM ${commentAiLabels} AS l
				WHERE l.comment_id = ${comments.id} AND l.matched = 1
				ORDER BY l.created_at DESC, l.id DESC LIMIT 1
			)) AS s WHERE s.value IN (${list})
		)
	)`;
}

const verdictSeverity = sql`json_extract(${comments.aiVerdict}, '$.severity')`;

const DAY_MS = 86_400_000;

function whereClause(f: TableFilters): SQL | undefined {
	const parts: (SQL | undefined)[] = [
		f.q ? contains(comments.body, f.q) : undefined,
		f.status ? inArray(comments.status, f.status) : undefined,
		f.categories ? hasCategory(f.categories) : undefined,
		f.minSeverity ? sql`${verdictSeverity} >= ${f.minSeverity}` : undefined,
		f.source ? eq(comments.moderationSource, f.source) : undefined,
		f.reported ? sql`${openReports} > 0` : undefined,
		f.title ? contains(titles.title, f.title) : undefined,
		f.author ? contains(users.username, f.author) : undefined,
		f.from ? gte(comments.createdAt, new Date(`${f.from}T00:00:00Z`)) : undefined,
		f.to
			? lt(comments.createdAt, new Date(new Date(`${f.to}T00:00:00Z`).getTime() + DAY_MS))
			: undefined
	];
	return and(...parts);
}

function orderBy(sort: TableFilters['sort']): SQL[] {
	switch (sort) {
		case 'oldest':
			return [asc(comments.createdAt), asc(comments.id)];
		case 'reports':
			return [sql`${openReports} DESC`, desc(comments.createdAt), desc(comments.id)];
		case 'severity':
			// A comment with no verdict has a null severity, which sorts last descending.
			return [sql`${verdictSeverity} DESC`, desc(comments.createdAt), desc(comments.id)];
		default:
			return [desc(comments.createdAt), desc(comments.id)];
	}
}

/** Severity and failure code in a stored verdict; an unreadable one reads as none. */
function readVerdict(json: string | null): { severity: number | null; failure: string | null } {
	if (!json) return { severity: null, failure: null };
	try {
		const parsed = JSON.parse(json) as { severity?: unknown; failure?: unknown } | null;
		return {
			severity: typeof parsed?.severity === 'number' ? parsed.severity : null,
			failure: typeof parsed?.failure === 'string' ? parsed.failure : null
		};
	} catch {
		return { severity: null, failure: null };
	}
}

function readCategories(json: string): string[] {
	try {
		const parsed: unknown = JSON.parse(json);
		return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
	} catch {
		return [];
	}
}

/** The newest scan label of each comment in `ids`. */
async function latestLabels(ids: string[]): Promise<Map<string, AiLabel>> {
	const labels = new Map<string, AiLabel>();
	for (const chunk of chunkForD1(ids, 1)) {
		const rows = await db
			.select()
			.from(commentAiLabels)
			.where(inArray(commentAiLabels.commentId, chunk))
			.orderBy(desc(commentAiLabels.createdAt), desc(commentAiLabels.id));
		for (const row of rows) {
			if (labels.has(row.commentId)) continue;
			labels.set(row.commentId, {
				concern: row.concern,
				matched: row.matched,
				categories: readCategories(row.categories),
				severity: row.severity,
				reason: row.reason,
				createdAt: row.createdAt.toISOString()
			});
		}
	}
	return labels;
}

/**
 * One page of every comment in any status, deleted ones included (staff see them), filtered and
 * sorted as `filters` say. A page past the last returns no rows with the true total.
 */
export async function listModerationTable(filters: TableFilters): Promise<ModerationTable> {
	const where = whereClause(filters);
	const joined = () =>
		db
			.select({ comment: comments, author: users, title: titles })
			.from(comments)
			.innerJoin(users, eq(comments.userId, users.id))
			.innerJoin(titles, eq(comments.titleId, titles.id));
	const [rows, [counted]] = await Promise.all([
		joined()
			.where(where)
			.orderBy(...orderBy(filters.sort))
			.limit(TABLE_PAGE_SIZE)
			.offset((filters.page - 1) * TABLE_PAGE_SIZE),
		db
			.select({ n: sql<number>`count(*)` })
			.from(comments)
			.innerJoin(users, eq(comments.userId, users.id))
			.innerJoin(titles, eq(comments.titleId, titles.id))
			.where(where)
	]);
	const items = await toModerationItems(rows);
	const labels = await latestLabels(items.map((i) => i.comment.id));
	return {
		rows: items.map((item, i) => {
			const verdict = readVerdict(rows[i].comment.aiVerdict);
			return {
				...item,
				severity: verdict.severity,
				aiFailure: verdict.failure,
				latestLabel: labels.get(item.comment.id) ?? null
			};
		}),
		total: counted?.n ?? 0,
		page: filters.page,
		pageSize: TABLE_PAGE_SIZE
	};
}
