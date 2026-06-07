import { describe, expect, test } from 'vitest';
import {
	scoreSafety,
	scoreRepresentation,
	femaleShare,
	leadsFemaleShare,
	directorOrCrewShare,
	toneTokens,
	SAFETY_HARMFUL_FLAGS,
	SAFETY_CAUTION_FLAGS,
} from '$lib/media/utils/verdict';
import type { GenderBreakdown, CastMember, CrewDepartment } from '$lib/media/types/media';
import type { DddResult, TriggerTag } from '$lib/media/types/ddd';
import type { UmFlagKey } from '$lib/media/utils/metrics';

// ── helpers ──────────────────────────────────────────────────────────────────

function mkBreakdown(partial: Partial<GenderBreakdown> = {}): GenderBreakdown {
	return { female: 0, male: 0, nonBinary: 0, unknown: 0, total: 0, ...partial };
}

type UmRecord = Record<UmFlagKey, boolean>;
const UM_KEYS: UmFlagKey[] = [
	'noRape', 'rapeMenDisImp', 'sexHarOnScrn', 'sexAdultTeen',
	'childSexAbuse', 'incest', 'attemptedRape', 'rapeOffScrn', 'rapeOnScreen',
];

function mkUm(overrides: Partial<UmRecord> = {}): UmRecord {
	const base = Object.fromEntries(UM_KEYS.map((k) => [k, false])) as UmRecord;
	return { ...base, ...overrides };
}

function mkTag(doesName: string, yesSum: number, noSum: number): TriggerTag {
	return { topicItemId: 1, topicId: 1, doesName, yesSum, noSum, comment: null, category: null, season: null, episode: null };
}

function mkDdd(tags: TriggerTag[] = []): DddResult {
	return { itemId: 1, tags, isSeries: false };
}

const safeCast = mkBreakdown({ female: 5, male: 5, total: 10 });
const safeCrew = mkBreakdown({ female: 4, male: 6, total: 10 });
const safeMembers: CastMember[] = [
	{ name: 'A', gender: 'female', order: 0 },
	{ name: 'B', gender: 'female', order: 1 },
	{ name: 'C', gender: 'male', order: 2 },
	{ name: 'D', gender: 'female', order: 3 },
	{ name: 'E', gender: 'male', order: 4 },
];

// ── femaleShare ───────────────────────────────────────────────────────────────

describe('femaleShare', () => {
	test('null when denom is 0', () => {
		expect(femaleShare(mkBreakdown({ unknown: 5, total: 5 }))).toBeNull();
	});

	test('ignores unknown in denom', () => {
		const b = mkBreakdown({ female: 3, male: 7, unknown: 10, total: 20 });
		expect(femaleShare(b)).toBeCloseTo(0.3);
	});

	test('1.0 when all female', () => {
		expect(femaleShare(mkBreakdown({ female: 10, total: 10 }))).toBe(1);
	});
});

// ── leadsFemaleShare ──────────────────────────────────────────────────────────

describe('leadsFemaleShare', () => {
	test('null on empty array', () => {
		expect(leadsFemaleShare([])).toBeNull();
	});

	test('clamps topN to list length', () => {
		const members: CastMember[] = [{ name: 'A', gender: 'female', order: 0 }];
		expect(leadsFemaleShare(members, 5)).toBe(1 / 1);
	});

	test('returns null when all unknown in top N', () => {
		const members: CastMember[] = Array.from({ length: 5 }, (_, i) => ({
			name: 'X', gender: 'unknown' as const, order: i,
		}));
		expect(leadsFemaleShare(members)).toBeNull();
	});

	test('counts female over total slice (not just known)', () => {
		// 2 female, 2 male, 1 unknown → 2/5
		const members: CastMember[] = [
			{ name: 'A', gender: 'female', order: 0 },
			{ name: 'B', gender: 'female', order: 1 },
			{ name: 'C', gender: 'male', order: 2 },
			{ name: 'D', gender: 'male', order: 3 },
			{ name: 'E', gender: 'unknown', order: 4 },
		];
		expect(leadsFemaleShare(members)).toBeCloseTo(2 / 5);
	});
});

// ── directorOrCrewShare ───────────────────────────────────────────────────────

describe('directorOrCrewShare', () => {
	test('aggregates over priority departments (Directing + Writing)', () => {
		const crew = mkBreakdown({ female: 0, male: 10, total: 10 });
		const depts: CrewDepartment[] = [
			{ department: 'Directing', breakdown: mkBreakdown({ female: 2, male: 8, total: 10 }), jobs: [] },
			{ department: 'Writing', breakdown: mkBreakdown({ female: 4, male: 6, total: 10 }), jobs: [] },
		];
		// combined: 6 female / 20 total = 0.3
		expect(directorOrCrewShare(crew, depts)).toBeCloseTo(0.3);
	});

	test('falls back to crew when no priority depts present', () => {
		const crew = mkBreakdown({ female: 4, male: 6, total: 10 });
		const depts: CrewDepartment[] = [
			{ department: 'Stunts', breakdown: mkBreakdown({ female: 0, male: 10, total: 10 }), jobs: [] },
		];
		expect(directorOrCrewShare(crew, depts)).toBeCloseTo(0.4);
	});

	test('falls back to crew when departments array is empty', () => {
		const crew = mkBreakdown({ female: 4, male: 6, total: 10 });
		expect(directorOrCrewShare(crew, [])).toBeCloseTo(0.4);
	});

	test('ignores non-priority departments when priority ones exist', () => {
		const crew = mkBreakdown({ female: 0, male: 10, total: 10 });
		const depts: CrewDepartment[] = [
			{ department: 'Directing', breakdown: mkBreakdown({ female: 5, male: 5, total: 10 }), jobs: [] },
			{ department: 'Stunts', breakdown: mkBreakdown({ female: 0, male: 20, total: 20 }), jobs: [] },
		];
		// Only Directing counts → 5/10 = 0.5
		expect(directorOrCrewShare(crew, depts)).toBeCloseTo(0.5);
	});
});

// ── toneTokens ────────────────────────────────────────────────────────────────

describe('toneTokens', () => {
	test('success maps to --success tokens', () => {
		expect(toneTokens('success')).toEqual({ fg: '--success', soft: '--success-soft', on: '--success-fg' });
	});
	test('warn', () => {
		expect(toneTokens('warn')).toEqual({ fg: '--warn', soft: '--warn-soft', on: '--warn-fg' });
	});
	test('danger', () => {
		expect(toneTokens('danger')).toEqual({ fg: '--danger', soft: '--danger-soft', on: '--danger-fg' });
	});
	test('neutral maps to --info tokens', () => {
		expect(toneTokens('neutral')).toEqual({ fg: '--info', soft: '--info-soft', on: '--info-fg' });
	});
});

// ── scoreSafety ───────────────────────────────────────────────────────────────

describe('scoreSafety', () => {
	test('unknown when umData null and ddd null', () => {
		const r = scoreSafety(null, null);
		expect(r.tier).toBe('unknown');
		expect(r.tone).toBe('neutral');
		expect(r.signalsPresent).toBe(0);
		expect(r.pending).toBe(true);
	});

	test('unknown when umData null and ddd has empty tags', () => {
		const r = scoreSafety(null, mkDdd([]));
		expect(r.tier).toBe('unknown');
		expect(r.signalsPresent).toBe(0);
	});

	test('safe with noRape true, ddd null → pending', () => {
		const r = scoreSafety(mkUm({ noRape: true }), null);
		expect(r.tier).toBe('safe');
		expect(r.pending).toBe(true);
		expect(r.signalsPresent).toBe(1);
		expect(r.signalsTotal).toBe(2);
	});

	test('safe when all flags false, ddd null → pending', () => {
		const r = scoreSafety(mkUm(), null);
		expect(r.tier).toBe('safe');
		expect(r.pending).toBe(true);
	});

	// each harmful flag individually
	for (const flag of SAFETY_HARMFUL_FLAGS) {
		test(`harmful when ${flag} is true`, () => {
			const r = scoreSafety(mkUm({ [flag]: true } as Partial<UmRecord>), null);
			expect(r.tier).toBe('harmful');
			expect(r.tone).toBe('danger');
		});
	}

	// each caution flag individually
	for (const flag of SAFETY_CAUTION_FLAGS) {
		test(`caution when ${flag} is true`, () => {
			const r = scoreSafety(mkUm({ [flag]: true } as Partial<UmRecord>), null);
			expect(r.tier).toBe('caution');
			expect(r.tone).toBe('warn');
		});
	}

	test('harmful beats caution (max severity wins)', () => {
		const r = scoreSafety(mkUm({ sexHarOnScrn: true, rapeOnScreen: true }), null);
		expect(r.tier).toBe('harmful');
	});

	test('DDD SV tag with yesSum > noSum escalates to harmful', () => {
		const r = scoreSafety(null, mkDdd([mkTag('Rape', 10, 2)]));
		expect(r.tier).toBe('harmful');
		expect(r.signalsPresent).toBe(1);
	});

	test('DDD SV tag with yesSum <= noSum does not escalate (tier remains safe)', () => {
		// UM null, DDD has a tag but the SV vote is tied → no escalation, no UM → safe (1 signal)
		const r = scoreSafety(null, mkDdd([mkTag('Rape', 5, 5)]));
		expect(r.tier).toBe('safe');
		expect(r.signalsPresent).toBe(1);
	});

	test('caution UM + affirmed DDD SV tag → harmful', () => {
		const r = scoreSafety(mkUm({ sexHarOnScrn: true }), mkDdd([mkTag('Sexual assault', 8, 1)]));
		expect(r.tier).toBe('harmful');
		expect(r.signalsPresent).toBe(2);
	});

	test('non-SV DDD tag does not escalate', () => {
		const r = scoreSafety(mkUm({ noRape: true }), mkDdd([mkTag('Animal dies', 10, 0)]));
		expect(r.tier).toBe('safe');
	});

	test('DDD-arrives-later: provisional then final recompute', () => {
		const um = mkUm({ noRape: true });
		const provisional = scoreSafety(um, null);
		expect(provisional.tier).toBe('safe');
		expect(provisional.pending).toBe(true);

		const resolved = scoreSafety(um, mkDdd([mkTag('Rape', 10, 1)]));
		expect(resolved.tier).toBe('harmful');
		expect(resolved.pending).toBe(false);
	});

	test('pending false when ddd is resolved (even empty)', () => {
		const r = scoreSafety(mkUm(), mkDdd([]));
		expect(r.pending).toBe(false);
	});

	// ── signals ──────────────────────────────────────────────────────────────

	test('rapeOnScreen → signals contains Rape on screen with danger tone', () => {
		const r = scoreSafety(mkUm({ rapeOnScreen: true }), null);
		const sig = r.signals.find((s) => s.label === 'Rape on screen');
		expect(sig).toBeDefined();
		expect(sig?.detail).toBe('Flagged');
		expect(sig?.tone).toBe('danger');
	});

	test('caution flag → signals entry with warn tone', () => {
		const r = scoreSafety(mkUm({ sexHarOnScrn: true }), null);
		const sig = r.signals.find((s) => s.label === 'Sexual harassment on screen');
		expect(sig).toBeDefined();
		expect(sig?.tone).toBe('warn');
	});

	test('noRape never appears in signals', () => {
		const r = scoreSafety(mkUm({ noRape: true }), null);
		expect(r.signals.every((s) => !s.label.toLowerCase().includes('no rape'))).toBe(true);
	});

	test('signals are in UM_FLAGS declaration order when multiple flags true', () => {
		const r = scoreSafety(mkUm({ rapeOnScreen: true, sexHarOnScrn: true }), null);
		const labels = r.signals.filter((s) => s.present).map((s) => s.label);
		const harIdx = labels.indexOf('Sexual harassment on screen');
		const rapeIdx = labels.indexOf('Rape on screen');
		expect(harIdx).toBeLessThan(rapeIdx); // sexHarOnScrn declared before rapeOnScreen
	});

	test('affirmed DDD SV tag → Community trigger warnings signal with danger tone', () => {
		const r = scoreSafety(null, mkDdd([mkTag('Rape', 10, 2)]));
		const sig = r.signals.find((s) => s.label === 'Community trigger warnings');
		expect(sig).toBeDefined();
		expect(sig?.detail).toBe('1 warning');
		expect(sig?.tone).toBe('danger');
	});

	test('non-escalating DDD tag → Community trigger warnings signal with neutral tone', () => {
		const r = scoreSafety(null, mkDdd([mkTag('Rape', 5, 5)]));
		const sig = r.signals.find((s) => s.label === 'Community trigger warnings');
		expect(sig).toBeDefined();
		expect(sig?.tone).toBe('neutral');
	});

	test('two DDD tags → plural "2 warnings"', () => {
		const r = scoreSafety(null, mkDdd([mkTag('Animal dies', 5, 1), mkTag('Rape', 10, 2)]));
		const sig = r.signals.find((s) => s.label === 'Community trigger warnings');
		expect(sig?.detail).toBe('2 warnings');
	});

	test('safe sentinel when nothing flagged', () => {
		const r = scoreSafety(mkUm(), mkDdd([]));
		expect(r.signals).toHaveLength(1);
		expect(r.signals[0]).toMatchObject({
			label: 'No sexual violence flagged',
			detail: 'Clear',
			present: false,
			tone: 'success',
		});
	});

	test('summary does not contain a parenthetical count', () => {
		const harmful = scoreSafety(mkUm({ rapeOnScreen: true }), mkDdd([mkTag('Rape', 10, 1)]));
		const caution = scoreSafety(mkUm({ sexHarOnScrn: true }), null);
		const safe = scoreSafety(mkUm({ noRape: true }), mkDdd([]));
		for (const r of [harmful, caution, safe]) {
			expect(r.summary).not.toContain('(');
		}
	});
});

// ── scoreRepresentation ───────────────────────────────────────────────────────

describe('scoreRepresentation', () => {
	const baseInput = {
		cast: safeCast,
		crew: safeCrew,
		castMembers: safeMembers,
		crewDepartments: [] as CrewDepartment[],
		bechdel: { rating: 3 },
		isSeries: false,
	};

	test('strong: high cast, leads, crew, bechdel 3', () => {
		// baseInput: cast 50%, leads 60%, crew 40% → all score 1 (below 70%); bechdel 3→2
		// avg = (1+1+1+2)/4 = 1.25 → mixed under new 70% thresholds
		const r = scoreRepresentation(baseInput);
		expect(r.tier).toBe('mixed');
		expect(r.signalsPresent).toBe(4);
		expect(r.signalsTotal).toBe(4);
	});

	test('poor: very low female presence', () => {
		const r = scoreRepresentation({
			cast: mkBreakdown({ female: 1, male: 9, total: 10 }),
			crew: mkBreakdown({ female: 1, male: 9, total: 10 }),
			castMembers: [
				{ name: 'A', gender: 'male', order: 0 },
				{ name: 'B', gender: 'male', order: 1 },
				{ name: 'C', gender: 'male', order: 2 },
				{ name: 'D', gender: 'male', order: 3 },
				{ name: 'E', gender: 'female', order: 4 },
			],
			crewDepartments: [],
			bechdel: { rating: 0 },
			isSeries: false,
		});
		expect(r.tier).toBe('poor');
		expect(r.tone).toBe('danger');
	});

	test('mixed: mid values', () => {
		// cast 0.5→1, crew 0.5→1, leads 2/5=0.4→1, bechdel 2→1
		// avg = (1+1+1+1)/4 = 1.0 → mixed
		const r = scoreRepresentation({
			cast: mkBreakdown({ female: 5, male: 5, total: 10 }),
			crew: mkBreakdown({ female: 5, male: 5, total: 10 }),
			castMembers: [
				{ name: 'A', gender: 'female', order: 0 },
				{ name: 'B', gender: 'female', order: 1 },
				{ name: 'C', gender: 'male', order: 2 },
				{ name: 'D', gender: 'male', order: 3 },
				{ name: 'E', gender: 'male', order: 4 },
			],
			crewDepartments: [],
			bechdel: { rating: 2 },
			isSeries: false,
		});
		expect(r.tier).toBe('mixed');
	});

	test('avg exactly 1.75 → strong', () => {
		// cast 0.7→2, crew 0.7→2, leads 4/5=0.8→2, bechdel 2→1
		// avg = (2+2+2+1)/4 = 1.75 → strong
		const r = scoreRepresentation({
			cast: mkBreakdown({ female: 7, male: 3, total: 10 }),
			crew: mkBreakdown({ female: 7, male: 3, total: 10 }),
			castMembers: [
				{ name: 'A', gender: 'female', order: 0 },
				{ name: 'B', gender: 'female', order: 1 },
				{ name: 'C', gender: 'female', order: 2 },
				{ name: 'D', gender: 'female', order: 3 },
				{ name: 'E', gender: 'male', order: 4 },
			],
			crewDepartments: [],
			bechdel: { rating: 2 },
			isSeries: false,
		});
		expect(r.tier).toBe('strong');
	});

	test('avg just below 1.75 → mixed', () => {
		// cast 0.7→2, crew 0.7→2, leads 2/5=0.4→1, bechdel 2→1
		// avg = (2+2+1+1)/4 = 1.5 → mixed
		const r = scoreRepresentation({
			cast: mkBreakdown({ female: 7, male: 3, total: 10 }),
			crew: mkBreakdown({ female: 7, male: 3, total: 10 }),
			castMembers: [
				{ name: 'A', gender: 'female', order: 0 },
				{ name: 'B', gender: 'female', order: 1 },
				{ name: 'C', gender: 'male', order: 2 },
				{ name: 'D', gender: 'male', order: 3 },
				{ name: 'E', gender: 'male', order: 4 },
			],
			crewDepartments: [],
			bechdel: { rating: 2 },
			isSeries: false,
		});
		expect(r.tier).toBe('mixed');
	});

	test('avg exactly 1.0 → mixed', () => {
		// cast 0.5→1, crew 0.5→1, leads 0→0, bechdel 3→2 → avg=(1+1+0+2)/4=1.0 → mixed
		const r = scoreRepresentation({
			cast: mkBreakdown({ female: 5, male: 5, total: 10 }),
			crew: mkBreakdown({ female: 5, male: 5, total: 10 }),
			castMembers: Array.from({ length: 5 }, (_, i) => ({
				name: 'X', gender: 'male' as const, order: i,
			})),
			crewDepartments: [],
			bechdel: { rating: 3 },
			isSeries: false,
		});
		expect(r.tier).toBe('mixed');
	});

	test('avg just below 1.0 → poor', () => {
		// cast 0.5→1, crew 0.5→1, leads 0→0, bechdel 0→0 → avg=(1+1+0+0)/4=0.5 → poor
		const r = scoreRepresentation({
			cast: mkBreakdown({ female: 5, male: 5, total: 10 }),
			crew: mkBreakdown({ female: 5, male: 5, total: 10 }),
			castMembers: Array.from({ length: 5 }, (_, i) => ({
				name: 'X', gender: 'male' as const, order: i,
			})),
			crewDepartments: [],
			bechdel: { rating: 0 },
			isSeries: false,
		});
		expect(r.tier).toBe('poor');
	});

	test('series: Bechdel excluded, signalsTotal=3, rates normally with cast+crew', () => {
		const r = scoreRepresentation({
			...baseInput,
			bechdel: null,
			isSeries: true,
		});
		expect(r.signalsTotal).toBe(3);
		expect(r.tier).not.toBe('unknown');
		expect(r.signalsPresent).toBeGreaterThanOrEqual(2);
	});

	test('unknown when signalsPresent < 2', () => {
		const r = scoreRepresentation({
			cast: mkBreakdown({ unknown: 10, total: 10 }), // femaleShare null
			crew: mkBreakdown({ unknown: 10, total: 10 }), // directorOrCrewShare null
			castMembers: [], // leadsFemaleShare null
			crewDepartments: [],
			bechdel: null,
			isSeries: true,
		});
		expect(r.tier).toBe('unknown');
		expect(r.tone).toBe('neutral');
		expect(r.signalsPresent).toBe(0);
	});

	test('unknown when all unknown genders and null bechdel (movie)', () => {
		const r = scoreRepresentation({
			cast: mkBreakdown({ unknown: 10, total: 10 }),
			crew: mkBreakdown({ unknown: 10, total: 10 }),
			castMembers: [],
			crewDepartments: [],
			bechdel: null,
			isSeries: false,
		});
		expect(r.tier).toBe('unknown');
		expect(r.signalsPresent).toBe(0);
	});

	// ── signals ──────────────────────────────────────────────────────────────

	test('strong: signals include all four in order', () => {
		const r = scoreRepresentation(baseInput);
		expect(r.signals.map((s) => s.label)).toEqual([
			'Cast — women',
			'Leads — women',
			'Crew — women',
			'Bechdel',
		]);
		expect(r.signals.find((s) => s.label === 'Bechdel')?.detail).toBe('3/3');
		expect(r.signals.find((s) => s.label === 'Bechdel')?.tone).toBe('success');
	});

	test('series: no Bechdel signal', () => {
		const r = scoreRepresentation({ ...baseInput, bechdel: null, isSeries: true });
		expect(r.signals.some((s) => s.label === 'Bechdel')).toBe(false);
		expect(r.signals.length).toBeLessThanOrEqual(3);
	});

	test('leads detail formatted as "N/5 women"', () => {
		// 1 female in top 5 → "1/5 women"
		const r = scoreRepresentation({
			cast: mkBreakdown({ female: 3, male: 7, total: 10 }),
			crew: mkBreakdown({ female: 3, male: 7, total: 10 }),
			castMembers: [
				{ name: 'A', gender: 'female', order: 0 },
				{ name: 'B', gender: 'male', order: 1 },
				{ name: 'C', gender: 'male', order: 2 },
				{ name: 'D', gender: 'male', order: 3 },
				{ name: 'E', gender: 'male', order: 4 },
			],
			crewDepartments: [],
			bechdel: { rating: 2 },
			isSeries: false,
		});
		const sig = r.signals.find((s) => s.label === 'Leads — women');
		expect(sig?.detail).toBe('1/5 women');
	});

	test('sub-tone: score 0 → danger, 1 → warn, 2 → success', () => {
		// poor: low cast (0), low leads (0), low crew (0), bechdel 0 (0)
		const r = scoreRepresentation({
			cast: mkBreakdown({ female: 1, male: 9, total: 10 }),
			crew: mkBreakdown({ female: 1, male: 9, total: 10 }),
			castMembers: Array.from({ length: 5 }, (_, i) => ({ name: 'X', gender: 'male' as const, order: i })),
			crewDepartments: [],
			bechdel: { rating: 0 },
			isSeries: false,
		});
		expect(r.signals.every((s) => s.tone === 'danger')).toBe(true);
	});

	test('unknown branch still includes partial signals', () => {
		// only cast data, nothing else
		const r = scoreRepresentation({
			cast: mkBreakdown({ female: 5, male: 5, total: 10 }),
			crew: mkBreakdown({ unknown: 10, total: 10 }),
			castMembers: [],
			crewDepartments: [],
			bechdel: null,
			isSeries: false,
		});
		expect(r.tier).toBe('unknown');
		expect(r.signals.some((s) => s.label === 'Cast — women')).toBe(true);
	});
});
