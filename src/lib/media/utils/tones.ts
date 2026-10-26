import type { UmFlagKey } from './metrics';
import { SAFETY_CAUTION_FLAGS, SAFETY_HARMFUL_FLAGS, type SafetyTier } from './verdict';

/** Badge colours: green, amber, rose, grey, violet. */
export type BadgeTone = 'pos' | 'mid' | 'neg' | 'neutral' | 'brand';

/** Mirrors the representation verdict's Bechdel signal: 3/3 → 2, 2/3 → 1, lower → 0. */
export function bechdelTone(rating: number): BadgeTone {
	return rating === 3 ? 'pos' : rating === 2 ? 'mid' : 'neg';
}

/** A safety tier from the Unconsenting Media flags alone; null without an entry. */
export function safetyTierTone(tier: SafetyTier | null): BadgeTone {
	if (tier === 'harmful') return 'neg';
	if (tier === 'caution') return 'mid';
	if (tier === 'safe') return 'pos';
	return 'neutral';
}

/** The UM-only safety tier of an entry, as a tone: harmful flag → rose, caution → amber. */
export function umTone(entry: Record<UmFlagKey, boolean> | null): BadgeTone {
	if (!entry) return 'neutral';
	if (SAFETY_HARMFUL_FLAGS.some((k) => entry[k])) return 'neg';
	if (SAFETY_CAUTION_FLAGS.some((k) => entry[k])) return 'mid';
	return 'pos';
}

/** Mirrors the representation verdict's share thresholds: 70% or more → 2, 40% → 1. */
export function shareTone(share: number | null): BadgeTone {
	if (share === null) return 'neutral';
	return share >= 0.7 ? 'pos' : share >= 0.4 ? 'mid' : 'neg';
}
