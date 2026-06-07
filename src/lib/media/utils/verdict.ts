import type { GenderBreakdown, CastMember, CrewDepartment } from '$lib/media/types/media';
import type { DddResult } from '$lib/media/types/ddd';
import { UM_FLAGS, type UmFlagKey } from './metrics';

export type VerdictTone = 'success' | 'warn' | 'danger' | 'neutral';
export type SafetyTier = 'safe' | 'caution' | 'harmful' | 'unknown';
export type RepTier = 'strong' | 'mixed' | 'poor' | 'unknown';

export interface VerdictSignal {
	label: string;
	detail: string;
	present: boolean;
	tone?: VerdictTone;
}

export interface AxisVerdict<Tier extends string> {
	axis: 'safety' | 'representation';
	tier: Tier;
	label: string;
	summary: string;
	signals: VerdictSignal[];
	signalsPresent: number;
	signalsTotal: number;
	tone: VerdictTone;
	icon: string;
	pending?: boolean;
}

export type SafetyVerdict = AxisVerdict<SafetyTier> & { axis: 'safety' };
export type RepVerdict = AxisVerdict<RepTier> & { axis: 'representation' };

export interface BechdelLike {
	rating: number;
}

export interface ToneTokens {
	fg: string;
	soft: string;
	on: string;
}

const UM_LABELS: Record<UmFlagKey, string> = Object.fromEntries(
	UM_FLAGS.map((f) => [f.key, f.label]),
) as Record<UmFlagKey, string>;

function subTone(score: number | null): VerdictTone {
	if (score === 2) return 'success';
	if (score === 1) return 'warn';
	if (score === 0) return 'danger';
	return 'neutral';
}

export const SAFETY_HARMFUL_FLAGS: UmFlagKey[] = [
	'rapeOnScreen',
	'rapeOffScrn',
	'attemptedRape',
	'childSexAbuse',
	'incest',
];

export const SAFETY_CAUTION_FLAGS: UmFlagKey[] = [
	'sexHarOnScrn',
	'sexAdultTeen',
	'rapeMenDisImp',
];

export const SV_DDD_MATCHERS: string[] = [
	'rape',
	'sexual assault',
	'sexual abuse',
	'molest',
	'incest',
];

// Departments whose gender composition matters most for the representation verdict.
// Must stay in sync with PRIORITY_DEPARTMENTS in tmdb.ts.
export const CREW_SCORED_DEPARTMENTS = ['Directing', 'Writing', 'Production', 'Editing', 'Camera'] as const;

export function femaleShare(b: GenderBreakdown): number | null {
	const denom = b.female + b.male + b.nonBinary;
	if (denom === 0) return null;
	return b.female / denom;
}

export function leadsFemaleShare(members: CastMember[], topN = 5): number | null {
	if (members.length === 0) return null;
	const top = members.slice(0, Math.min(topN, members.length));
	const denom = top.filter((m) => m.gender !== 'unknown').length;
	if (denom === 0) return null;
	const female = top.filter((m) => m.gender === 'female').length;
	return female / top.length;
}

export function directorOrCrewShare(
	crew: GenderBreakdown,
	departments: CrewDepartment[],
): number | null {
	// Aggregate over the important departments only; fall back to full crew when none present.
	const scored = departments.filter((d) =>
		(CREW_SCORED_DEPARTMENTS as readonly string[]).includes(d.department),
	);
	if (scored.length === 0) return femaleShare(crew);
	const combined: GenderBreakdown = scored.reduce(
		(acc, d) => ({
			female: acc.female + d.breakdown.female,
			male: acc.male + d.breakdown.male,
			nonBinary: acc.nonBinary + d.breakdown.nonBinary,
			unknown: acc.unknown + d.breakdown.unknown,
			total: acc.total + d.breakdown.total,
		}),
		{ female: 0, male: 0, nonBinary: 0, unknown: 0, total: 0 },
	);
	return femaleShare(combined);
}

function scoreShare(share: number | null, thresholdHigh: number, thresholdMid: number): number | null {
	if (share === null) return null;
	if (share >= thresholdHigh) return 2;
	if (share >= thresholdMid) return 1;
	return 0;
}

export function toneTokens(tone: VerdictTone): ToneTokens {
	switch (tone) {
		case 'success':
			return { fg: '--success', soft: '--success-soft', on: '--success-fg' };
		case 'warn':
			return { fg: '--warn', soft: '--warn-soft', on: '--warn-fg' };
		case 'danger':
			return { fg: '--danger', soft: '--danger-soft', on: '--danger-fg' };
		case 'neutral':
			return { fg: '--info', soft: '--info-soft', on: '--info-fg' };
	}
}

export function scoreSafety(
	umData: Record<UmFlagKey, boolean> | null,
	ddd: DddResult | null,
): SafetyVerdict {
	// Signal presence
	const hasUm = umData !== null;
	const hasDdd = ddd !== null && ddd.tags.length > 0;
	const signalsPresent = (hasUm ? 1 : 0) + (hasDdd ? 1 : 0);
	const signalsTotal = 2;
	const pending = ddd === null; // DDD still streaming

	// Not enough data
	if (!hasUm && !hasDdd) {
		return {
			axis: 'safety',
			tier: 'unknown',
			label: 'Not enough data',
			summary: "We don't have enough signals to rate content safety yet.",
			signals: [],
			signalsPresent: 0,
			signalsTotal,
			tone: 'neutral',
			icon: 'ri-question-line',
			pending,
		};
	}

	// UM flag scoring
	type Tier = 'safe' | 'caution' | 'harmful';
	let umTier: Tier = 'safe';
	if (hasUm) {
		const isHarmful = SAFETY_HARMFUL_FLAGS.some((k) => umData![k] === true);
		const isCaution = !isHarmful && SAFETY_CAUTION_FLAGS.some((k) => umData![k] === true);
		if (isHarmful) umTier = 'harmful';
		else if (isCaution) umTier = 'caution';
	}

	// DDD escalation (only to harmful)
	let dddEscalates = false;
	if (hasDdd) {
		dddEscalates = ddd!.tags.some((tag) => {
			const name = tag.doesName.toLowerCase();
			return tag.yesSum > tag.noSum && SV_DDD_MATCHERS.some((m) => name.includes(m));
		});
	}

	// Max severity
	const severityOrder: Tier[] = ['safe', 'caution', 'harmful'];
	const dddTier: Tier | null = dddEscalates ? 'harmful' : null;
	const finalTierStr = [umTier, dddTier]
		.filter((t): t is Tier => t !== null)
		.sort((a, b) => severityOrder.indexOf(b) - severityOrder.indexOf(a))[0];
	const tier = finalTierStr ?? 'safe';

	// Build signals list
	const signals: VerdictSignal[] = [];

	// TRUE UM flags in declaration order, skipping noRape
	if (hasUm) {
		for (const f of UM_FLAGS) {
			if (f.key === 'noRape') continue;
			if (umData![f.key] === true) {
				signals.push({
					label: UM_LABELS[f.key],
					detail: 'Flagged',
					present: true,
					tone: SAFETY_HARMFUL_FLAGS.includes(f.key) ? 'danger'
						: SAFETY_CAUTION_FLAGS.includes(f.key) ? 'warn'
						: 'neutral',
				});
			}
		}
	}

	// DDD line when tags present
	if (hasDdd) {
		const n = ddd!.tags.length;
		signals.push({
			label: 'Community trigger warnings',
			detail: `${n} warning${n === 1 ? '' : 's'}`,
			present: true,
			tone: dddEscalates ? 'danger' : 'neutral',
		});
	}

	// Safe sentinel when nothing flagged
	if (signals.length === 0) {
		signals.push({ label: 'No sexual violence flagged', detail: 'Clear', present: false, tone: 'success' });
	}

	const SAFETY_META: Record<Tier, { label: string; summary: string; tone: VerdictTone; icon: string }> = {
		safe: {
			label: 'Safer to watch',
			summary: 'No sexual violence flagged in our sources.',
			tone: 'success',
			icon: 'ri-shield-check-line',
		},
		caution: {
			label: 'Watch with caution',
			summary: 'Contains sexual harassment or coercion themes.',
			tone: 'warn',
			icon: 'ri-error-warning-line',
		},
		harmful: {
			label: 'Harmful content',
			summary: 'Depicts sexual assault or abuse.',
			tone: 'danger',
			icon: 'ri-alert-line',
		},
	};

	const meta = SAFETY_META[tier];
	return {
		axis: 'safety',
		tier,
		label: meta.label,
		summary: meta.summary,
		signals,
		signalsPresent,
		signalsTotal,
		tone: meta.tone,
		icon: meta.icon,
		pending,
	};
}

export function scoreRepresentation(input: {
	cast: GenderBreakdown;
	crew: GenderBreakdown;
	castMembers: CastMember[];
	crewDepartments: CrewDepartment[];
	bechdel: BechdelLike | null;
	isSeries: boolean;
}): RepVerdict {
	const { cast, crew, castMembers, crewDepartments, bechdel, isSeries } = input;
	const signalsTotal = isSeries ? 3 : 4;

	const castS = femaleShare(cast);
	const leadsS = leadsFemaleShare(castMembers);
	const crewS = directorOrCrewShare(crew, crewDepartments);

	const castScore = scoreShare(castS, 0.70, 0.40);
	const leadsScore = scoreShare(leadsS, 0.70, 0.40);
	const crewScore = scoreShare(crewS, 0.70, 0.40);
	const bechdelScore = !isSeries && bechdel !== null
		? (bechdel.rating === 3 ? 2 : bechdel.rating === 2 ? 1 : 0)
		: null;

	// Build signals (single site; included in both unknown and final return)
	const leadsN = Math.min(5, castMembers.length);
	const signals: VerdictSignal[] = [];
	if (castScore !== null) signals.push({ label: 'Cast — women', detail: `${Math.round(castS! * 100)}%`, present: true, tone: subTone(castScore) });
	if (leadsScore !== null) signals.push({ label: 'Leads — women', detail: `${Math.round(leadsS! * leadsN)}/${leadsN} women`, present: true, tone: subTone(leadsScore) });
	if (crewScore !== null) signals.push({ label: 'Crew — women', detail: `${Math.round(crewS! * 100)}%`, present: true, tone: subTone(crewScore) });
	if (bechdelScore !== null) signals.push({ label: 'Bechdel', detail: `${bechdel!.rating}/3`, present: true, tone: subTone(bechdelScore) });

	const scores = [castScore, leadsScore, crewScore, bechdelScore].filter(
		(s): s is number => s !== null,
	);
	const signalsPresent = scores.length;

	if (signalsPresent < 2) {
		return {
			axis: 'representation',
			tier: 'unknown',
			label: 'Not enough data',
			summary: 'Not enough gender data to assess representation.',
			signals,
			signalsPresent,
			signalsTotal,
			tone: 'neutral',
			icon: 'ri-question-line',
		};
	}

	const avg = scores.reduce((a, b) => a + b, 0) / signalsPresent;

	type RepTierKnown = 'strong' | 'mixed' | 'poor';
	const tier: RepTierKnown = avg >= 1.75 ? 'strong' : avg >= 1.0 ? 'mixed' : 'poor';

	const REP_META: Record<RepTierKnown, { label: string; summary: string; tone: VerdictTone; icon: string }> = {
		strong: {
			label: 'Strong representation',
			summary: 'Women are well represented on and off screen.',
			tone: 'success',
			icon: 'ri-women-line',
		},
		mixed: {
			label: 'Mixed representation',
			summary: 'Some female presence, but uneven across cast and crew.',
			tone: 'warn',
			icon: 'ri-scales-3-line',
		},
		poor: {
			label: 'Poor representation',
			summary: 'Few women in cast, crew, or story.',
			tone: 'danger',
			icon: 'ri-user-unfollow-line',
		},
	};

	const meta = REP_META[tier];
	return {
		axis: 'representation',
		tier,
		label: meta.label,
		summary: meta.summary,
		signals,
		signalsPresent,
		signalsTotal,
		tone: meta.tone,
		icon: meta.icon,
	};
}
