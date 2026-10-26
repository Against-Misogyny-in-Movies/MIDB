import { describe, expect, test } from 'vitest';
import { bechdelTone, safetyTierTone, shareTone, umTone } from '$lib/media/utils/tones';

const NONE = {
	noRape: false,
	rapeMenDisImp: false,
	sexHarOnScrn: false,
	sexAdultTeen: false,
	childSexAbuse: false,
	incest: false,
	attemptedRape: false,
	rapeOffScrn: false,
	rapeOnScreen: false
};

describe('tones', () => {
	test('bechdelTone follows the verdict mapping', () => {
		expect([3, 2, 1, 0].map(bechdelTone)).toEqual(['pos', 'mid', 'neg', 'neg']);
	});

	test('safetyTierTone', () => {
		expect(
			['safe', 'caution', 'harmful', 'unknown', null].map((t) => safetyTierTone(t as never))
		).toEqual(['pos', 'mid', 'neg', 'neutral', 'neutral']);
	});

	test('umTone: harmful beats caution, no flags is positive, no entry is neutral', () => {
		expect(umTone(null)).toBe('neutral');
		expect(umTone({ ...NONE, noRape: true })).toBe('pos');
		expect(umTone({ ...NONE, sexHarOnScrn: true })).toBe('mid');
		expect(umTone({ ...NONE, sexHarOnScrn: true, rapeOnScreen: true })).toBe('neg');
	});

	test('shareTone uses the 70% / 40% thresholds', () => {
		expect([0.7, 0.69, 0.4, 0.39, null].map(shareTone)).toEqual([
			'pos',
			'mid',
			'mid',
			'neg',
			'neutral'
		]);
	});
});
