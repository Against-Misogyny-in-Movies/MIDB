import { z } from 'zod';
import { VERDICT_CATEGORIES, commentStatus, moderationSource } from '#lib/media/utils/comments.ts';

/** Rows per page of the moderation table. */
export const TABLE_PAGE_SIZE = 50;

export const TABLE_SORTS = ['newest', 'oldest', 'reports', 'severity'] as const;

/** Longest text a substring filter takes. */
const TEXT_MAX = 200;
/** The last page the table pages to; a larger one reads as none. */
const PAGE_MAX = 10_000;

const severity = z.number().int().min(1).max(3);
const page = z.number().int().min(1).max(PAGE_MAX);
const text = z.string().trim().min(1).max(TEXT_MAX);
/** A calendar day, `YYYY-MM-DD`, that exists. */
const day = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine((value) => {
		const date = new Date(`${value}T00:00:00Z`);
		return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
	});

/**
 * What the moderation table filters and sorts on. Every field is optional except `sort` and
 * `page`. The filters live in the page's URL (`parseFilters`, `filtersToParams`).
 */
export const TableFilters = z.object({
	/** A substring of the comment body. */
	q: text.optional(),
	status: z.array(z.enum(commentStatus)).optional(),
	/** A comment matches when it has any of these, in its verdict or its latest matched scan label. */
	categories: z.array(z.enum(VERDICT_CATEGORIES)).optional(),
	/** The verdict's lowest severity, 1 to 3. */
	minSeverity: severity.optional(),
	source: z.enum(moderationSource).optional(),
	/** Only comments with an open report. */
	reported: z.literal(true).optional(),
	/** A substring of the title's name. */
	title: text.optional(),
	/** A substring of the author's username. */
	author: text.optional(),
	/** First and last day (UTC) a comment was posted, inclusive. */
	from: day.optional(),
	to: day.optional(),
	sort: z.enum(TABLE_SORTS).default('newest'),
	/** From 1. */
	page: page.default(1)
});

export type TableFilters = z.infer<typeof TableFilters>;

/** Keeps the values of `values` that `schema` accepts; `undefined` when none do. */
function kept<T>(schema: z.ZodType<T>, values: string[]): T[] | undefined {
	const out: T[] = [];
	for (const value of values) {
		const parsed = schema.safeParse(value);
		if (parsed.success && !out.includes(parsed.data)) out.push(parsed.data);
	}
	return out.length > 0 ? out : undefined;
}

/** Reads the filters from a URL's query. An unknown or bad value is dropped, never thrown. */
export function parseFilters(params: URLSearchParams): TableFilters {
	const one = <T>(
		schema: z.ZodType<T>,
		value: string | number | null | undefined
	): T | undefined => {
		if (value === null || value === undefined) return undefined;
		const parsed = schema.safeParse(value);
		return parsed.success ? parsed.data : undefined;
	};
	const number = (value: string | null) =>
		value !== null && /^\d+$/.test(value) ? Number(value) : undefined;
	const filters = TableFilters.safeParse({
		q: one(text, params.get('q')),
		status: kept(z.enum(commentStatus), params.getAll('status')),
		categories: kept(z.enum(VERDICT_CATEGORIES), params.getAll('category')),
		minSeverity: one(severity, number(params.get('severity'))),
		source: one(z.enum(moderationSource), params.get('source')),
		reported: params.get('reported') === '1' ? true : undefined,
		title: one(text, params.get('title')),
		author: one(text, params.get('author')),
		from: one(day, params.get('from')),
		to: one(day, params.get('to')),
		sort: one(z.enum(TABLE_SORTS), params.get('sort')),
		page: one(page, number(params.get('page')))
	});
	// Every field above is already valid, so this holds; the fallback keeps a schema change from throwing.
	return filters.success ? filters.data : TableFilters.parse({});
}

/** The query for a filter set, leaving out every default so a plain table has a plain URL. */
export function filtersToParams(filters: TableFilters): URLSearchParams {
	const params = new URLSearchParams();
	if (filters.q) params.set('q', filters.q);
	for (const status of filters.status ?? []) params.append('status', status);
	for (const category of filters.categories ?? []) params.append('category', category);
	if (filters.minSeverity) params.set('severity', String(filters.minSeverity));
	if (filters.source) params.set('source', filters.source);
	if (filters.reported) params.set('reported', '1');
	if (filters.title) params.set('title', filters.title);
	if (filters.author) params.set('author', filters.author);
	if (filters.from) params.set('from', filters.from);
	if (filters.to) params.set('to', filters.to);
	if (filters.sort !== 'newest') params.set('sort', filters.sort);
	if (filters.page > 1) params.set('page', String(filters.page));
	return params;
}
