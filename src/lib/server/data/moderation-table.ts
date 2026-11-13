import { alias, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { and, asc, desc, eq, getTableName, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { commentAiLabels, comments } from '#db/schema/community.ts';
import { titles } from '#db/schema/titles.ts';
import { TABLE_PAGE_SIZE, type TableFilters } from '#lib/media/utils/moderationFilters.ts';
import {
	openReportCount,
	readAiVerdict,
	toModerationItems,
	withContext,
	type ModerationItem
} from './moderation-queue.ts';

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

/** `comment_ai_labels AS <alias>`: an aliased table renders as its alias alone in a `sql` template. */
const labelsAs = (aliased: object) =>
	sql`${sql.identifier(getTableName(commentAiLabels))} AS ${aliased}`;

/** True for the newest scan label of its comment, whatever its kind. */
function isNewestLabel(label: { id: AnySQLiteColumn; commentId: AnySQLiteColumn }): SQL {
	const newer = alias(commentAiLabels, 'newer_label');
	return sql`${label.id} = (
		SELECT ${newer.id} FROM ${labelsAs(newer)} WHERE ${newer.commentId} = ${label.commentId}
		ORDER BY ${newer.createdAt} DESC, ${newer.id} DESC LIMIT 1
	)`;
}

/**
 * Comments with a category in the verdict, or in the newest scan label when that label matched.
 * A newer scan that did not match hides an older one's categories, as the row's scan cell does.
 */
function hasCategory(categories: string[]): SQL {
	const list = sql.join(
		categories.map((c) => sql`${c}`),
		sql`, `
	);
	const label = alias(commentAiLabels, 'scan_label');
	return sql`(
		EXISTS (SELECT 1 FROM json_each(${comments.aiVerdict}, '$.categories') AS v WHERE v.value IN (${list}))
		OR EXISTS (
			SELECT 1 FROM ${labelsAs(label)}
			WHERE ${label.commentId} = ${comments.id} AND ${isNewestLabel(label)} AND ${label.matched} = 1
				AND EXISTS (SELECT 1 FROM json_each(${label.categories}) AS s WHERE s.value IN (${list}))
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
		f.reported ? sql`${openReportCount} > 0` : undefined,
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
			return [sql`${openReportCount} DESC`, desc(comments.createdAt), desc(comments.id)];
		case 'severity':
			// A comment with no verdict has a null severity, which sorts last descending.
			return [sql`${verdictSeverity} DESC`, desc(comments.createdAt), desc(comments.id)];
		default:
			return [desc(comments.createdAt), desc(comments.id)];
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
			.where(and(inArray(commentAiLabels.commentId, chunk), isNewestLabel(commentAiLabels)));
		for (const row of rows) {
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
	const [rows, [counted]] = await Promise.all([
		withContext(
			db.select({ comment: comments, author: users, title: titles }).from(comments).$dynamic()
		)
			.where(where)
			.orderBy(...orderBy(filters.sort))
			.limit(TABLE_PAGE_SIZE)
			.offset((filters.page - 1) * TABLE_PAGE_SIZE),
		withContext(
			db
				.select({ n: sql<number>`count(*)` })
				.from(comments)
				.$dynamic()
		).where(where)
	]);
	const items = await toModerationItems(rows);
	const labels = await latestLabels(items.map((i) => i.comment.id));
	return {
		rows: items.map((item, i) => {
			const verdict = readAiVerdict(rows[i].comment.aiVerdict);
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
