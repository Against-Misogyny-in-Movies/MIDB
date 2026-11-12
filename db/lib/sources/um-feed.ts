import { z } from 'zod';
import { normalizeTitle, stripTrailingYear } from '../normalizeTitle.ts';

/** The public feed of the Unconsenting Media catalogue, one request a day. */
export const UM_FEED_URL = 'https://www.unconsentingmedia.org/list.json';

export type UmKind = 'movie' | 'tv';

/** One UM item as `um_source` stores it, plus the kind the binding step needs. */
export interface UmSourceRow {
	umId: number;
	kind: UmKind;
	cleanName: string;
	cleanTitleKey: string;
	/** null = unknown */
	year: number | null;
	noRape: boolean;
	rapeMenDisImp: boolean;
	sexHarOnScrn: boolean;
	sexAdultTeen: boolean;
	childSexAbuse: boolean;
	incest: boolean;
	attemptedRape: boolean;
	rapeOffScrn: boolean;
	rapeOnScreen: boolean;
	comment: string | null;
	sourceUpdatedAt: Date;
}

// The feed's `itemType` values for the kinds MIDB covers; books, games and podcasts are skipped.
const ITEM_TYPES: Record<string, UmKind> = { movie: 'movie', 'tv show': 'tv' };

const text = z.string().nullish();

const itemSchema = z.object({
	id: z.number().int(),
	name: text,
	cleanName: text,
	cleanNameArticles: text,
	yearOfRelease: z.number().nullish(),
	comment: text,
	noRape: z.boolean(),
	rapeMenDisImp: z.boolean(),
	sexHarOnScrn: z.boolean(),
	sexAdultTeen: z.boolean(),
	childSexAbuse: z.boolean(),
	incest: z.boolean(),
	attemptedRape: z.boolean(),
	rapeOffScrn: z.boolean(),
	rapeOnScreen: z.boolean(),
	updatedAt: z.string().transform((value, ctx) => {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) {
			ctx.addIssue({ code: 'custom', message: `not a date: ${value}` });
			return z.NEVER;
		}
		return date;
	})
});

const kindSchema = z.object({ itemType: z.string() });

/**
 * Reads the feed's JSON array into `um_source` rows for films and series. It validates the
 * rows it keeps and throws on a shape change, so a changed feed stops the sync instead of
 * writing wrong data. An empty result is the caller's to reject.
 */
export function parseUmFeed(json: unknown): UmSourceRow[] {
	if (!Array.isArray(json)) throw new Error('The Unconsenting Media feed is not an array.');
	const rows: UmSourceRow[] = [];
	for (const raw of json as unknown[]) {
		const type = kindSchema.safeParse(raw);
		if (!type.success)
			throw new Error('The Unconsenting Media feed has an item without an itemType.');
		const kind = ITEM_TYPES[type.data.itemType.toLowerCase()];
		if (!kind) continue;

		const parsed = itemSchema.safeParse(raw);
		if (!parsed.success) {
			const id = (raw as { id?: unknown }).id;
			throw new Error(
				`The Unconsenting Media feed changed shape (item ${String(id)}): ${z.prettifyError(parsed.error)}`
			);
		}
		const item = parsed.data;

		// UM's own normalised name is the canonical key. Its `cleanNameArticles` may end in the year
		// ("wuthering heights 2026"), so the year is stripped for a stable key and kept as the year.
		const name = item.name?.trim() ?? '';
		const cleanName = item.cleanName?.trim() ?? '';
		const cleanNameArticles = item.cleanNameArticles?.trim() ?? '';
		const { key, year: embeddedYear } = stripTrailingYear(
			cleanNameArticles || cleanName || normalizeTitle(name)
		);
		const feedYear = item.yearOfRelease ?? null;
		rows.push({
			umId: item.id,
			kind,
			cleanName: cleanNameArticles || cleanName || name,
			cleanTitleKey: key,
			// UM writes "0" for "year unknown", so a non-positive year is null, never 0.
			year: embeddedYear ?? (feedYear !== null && feedYear > 0 ? feedYear : null),
			noRape: item.noRape,
			rapeMenDisImp: item.rapeMenDisImp,
			sexHarOnScrn: item.sexHarOnScrn,
			sexAdultTeen: item.sexAdultTeen,
			childSexAbuse: item.childSexAbuse,
			incest: item.incest,
			attemptedRape: item.attemptedRape,
			rapeOffScrn: item.rapeOffScrn,
			rapeOnScreen: item.rapeOnScreen,
			comment: item.comment?.trim() || null,
			sourceUpdatedAt: item.updatedAt
		});
	}
	return rows;
}
