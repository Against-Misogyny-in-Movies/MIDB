import { eq, inArray } from 'drizzle-orm';
import db from '$db/connections';
import { umSource } from '$db/schema/movie';
import { normalizeTitle, stripTrailingYear } from '$db/scripts/lib/normalizeTitle';
import type { UmCandidate } from '$lib/media/utils/metrics';
import type { MediaRef } from './media-queries';

export type { UmCandidate } from '$lib/media/utils/metrics';

const UM_CONCERN_COLS = [
	'rapeMenDisImp',
	'sexHarOnScrn',
	'sexAdultTeen',
	'childSexAbuse',
	'incest',
	'attemptedRape',
	'rapeOffScrn',
	'rapeOnScreen'
] as const;

function toCandidate(r: typeof umSource.$inferSelect): UmCandidate {
	return {
		umId: r.umId,
		cleanName: r.cleanName,
		year: r.year,
		flagCount: UM_CONCERN_COLS.filter((k) => r[k] === true).length,
		comment: r.comment,
		noRape: r.noRape,
		rapeMenDisImp: r.rapeMenDisImp,
		sexHarOnScrn: r.sexHarOnScrn,
		sexAdultTeen: r.sexAdultTeen,
		childSexAbuse: r.childSexAbuse,
		incest: r.incest,
		attemptedRape: r.attemptedRape,
		rapeOffScrn: r.rapeOffScrn,
		rapeOnScreen: r.rapeOnScreen
	};
}

/**
 * Resolve UM catalogue entries for a media item whose title has no seeded binding.
 *
 * Year is the disambiguator:
 *  - exact-year match → return it alone (rendered directly, no picker).
 *  - year known but no candidate shares it → this title isn't in UM; return [].
 *  - year unknown → genuinely ambiguous; return all candidates for the user to pick from.
 *
 * Nothing is persisted; a user's pick lives only for the current page view.
 */
export async function getUnconsentingCandidates(media: MediaRef): Promise<UmCandidate[]> {
	const titleKey = stripTrailingYear(normalizeTitle(media.title)).key;

	const altKeys = new Set([titleKey]);
	if (titleKey.endsWith('s')) altKeys.add(titleKey.slice(0, -1));
	else altKeys.add(titleKey + 's');
	const keys = [...altKeys];

	const rows = await db.query.umSource.findMany({
		where:
			keys.length === 1
				? eq(umSource.cleanTitleKey, keys[0])
				: inArray(umSource.cleanTitleKey, keys)
	});
	if (rows.length === 0) return [];

	const mediaYear = media.releaseDate ? parseInt(media.releaseDate.slice(0, 4), 10) : NaN;

	if (!Number.isNaN(mediaYear)) {
		const exact = rows.find((r) => r.year === mediaYear);
		if (exact) return [toCandidate(exact)];
		const nullYear = rows.filter((r) => r.year === null);
		if (nullYear.length > 0) return nullYear.slice(0, 5).map(toCandidate);
		return [];
	}

	return rows.slice(0, 5).map(toCandidate);
}
