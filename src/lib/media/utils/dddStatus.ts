import type { DddResult } from '#lib/media/types/ddd.ts';

export interface DddStatus {
	label: string;
	/** The label is a real reading (a warning count or "Warnings by episode"). */
	hasData: boolean;
	/** The lookup is still streaming. */
	busy: boolean;
}

/**
 * The header status of the Does the Dog Die section and its source-index item. `visibleCount` is
 * the warnings the current selection shows. A series with warnings only on episodes, and no season
 * picked, reads "Warnings by episode"; a picked season or episode with none reads "No warnings".
 */
export function dddStatus(
	ddd: DddResult | null,
	visibleCount: number,
	seasonPicked = false
): DddStatus {
	if (ddd === null) return { label: 'Loading…', hasData: false, busy: true };
	if (visibleCount > 0) {
		const label = `${visibleCount} warning${visibleCount === 1 ? '' : 's'}`;
		return { label, hasData: true, busy: false };
	}
	if (ddd.tags.length > 0 && !seasonPicked)
		return { label: 'Warnings by episode', hasData: true, busy: false };
	if (ddd.itemId === null) return { label: 'No data', hasData: false, busy: false };
	return { label: 'No warnings', hasData: false, busy: false };
}
