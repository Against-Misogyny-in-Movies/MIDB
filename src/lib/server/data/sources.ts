import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { titleBechdel, titleUm, umSource } from '$db/schema/sources';
import type { UmEntry } from '$lib/media/types/um';

export type BechdelData = typeof titleBechdel.$inferSelect;
type UmSourceRow = typeof umSource.$inferSelect;

/** The seeded BechdelTest.com rating for a title, or null. */
export async function getBechdel(titleId: string): Promise<BechdelData | null> {
	return (
		(await db.query.titleBechdel.findFirst({ where: eq(titleBechdel.titleId, titleId) })) ?? null
	);
}

/** The single `um_source` → `UmEntry` mapper, shared with the candidate picker. */
export function toUmEntry(r: UmSourceRow): UmEntry {
	return {
		umId: r.umId,
		cleanName: r.cleanName,
		year: r.year,
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
 * The UM entry bound to a title, read through `title_um` → `um_source`, so a UM reseed shows
 * up without touching the bindings. Null if the title has no seeded binding.
 */
export async function getUmEntry(titleId: string): Promise<UmEntry | null> {
	const [row] = await db
		.select({ um: umSource })
		.from(titleUm)
		.innerJoin(umSource, eq(titleUm.umId, umSource.umId))
		.where(eq(titleUm.titleId, titleId))
		.limit(1);
	return row ? toUmEntry(row.um) : null;
}
