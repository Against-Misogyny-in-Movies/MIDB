export const BECHDEL_TIERS = [
	{ level: 0, label: 'Two named women' },
	{ level: 1, label: 'Who talk to each other' },
	{ level: 2, label: 'About something other than a man' },
	{ level: 3, label: 'Passes the Bechdel Test' },
] as const;

export const UM_FLAGS = [
	{ key: 'noRape', label: 'No rape or sexual assault' },
	{ key: 'rapeMenDisImp', label: 'Rape or sexual assault mentioned/discussed/implied' },
	{ key: 'sexHarOnScrn', label: 'Sexual harassment on screen' },
	{ key: 'sexAdultTeen', label: 'Sexual relationship between adult and teenager' },
	{ key: 'childSexAbuse', label: 'Child sexual abuse' },
	{ key: 'incest', label: 'Incest' },
	{ key: 'attemptedRape', label: 'Attempted rape' },
	{ key: 'rapeOffScrn', label: 'Rape off-screen or strongly implied' },
	{ key: 'rapeOnScreen', label: 'Rape on screen' },
] as const;

export type UmFlagKey = (typeof UM_FLAGS)[number]['key'];

export function dddUrl(itemId: number | null): string {
	return itemId
		? `https://www.doesthedogdie.com/media/${itemId}`
		: 'https://www.doesthedogdie.com';
}

export function umFlagCount(umData: Record<UmFlagKey, boolean> | null): number {
	if (!umData) return 0;
	return UM_FLAGS.filter((f) => f.key !== 'noRape' && umData[f.key] === true).length;
}

/**
 * A UM catalogue entry surfaced for an ambiguous title. Carries the full flag
 * set + comment so a user-picked candidate renders the same UM section as a
 * seeded binding — entirely client-side, persisting nothing.
 */
export type UmCandidate = {
	umId: number;
	cleanName: string;
	year: number | null;
	flagCount: number;
	comment: string | null;
} & Record<UmFlagKey, boolean>;
