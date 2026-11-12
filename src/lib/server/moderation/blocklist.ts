import { env } from '#lib/server/env.ts';

/**
 * The public blocklist: whole words and phrases that reject a comment without a model call.
 * It is short on purpose: a word that is also a name or an everyday word in film discussion
 * stays off it, because the model still reads such a comment. The reports and the moderators
 * handle the rest, and a private `MODERATION_EXTRA_TERMS` secret adds terms at runtime.
 */
export const BLOCKLIST_TERMS: readonly string[] = [
	'nigger',
	'nigga',
	'faggot',
	'tranny',
	'kill yourself',
	'kys'
];

const LEET: Record<string, string> = {
	'0': 'o',
	'1': 'i',
	'3': 'e',
	'4': 'a',
	'5': 's',
	'7': 't',
	'@': 'a',
	$: 's'
};

/**
 * Reduces text to space-separated lowercase words, so common evasions meet the same form as
 * the terms. It folds case; accents and compatibility forms (NFKD: full-width letters, ligatures,
 * combining marks, but not Cyrillic or Greek look-alikes of Latin letters); zero-width and
 * soft-hyphen characters; leetspeak digits and `@`/`$`; runs of three or more of one character,
 * cut to two; and any separator between words. Punctuation or spaces between single letters join
 * them only in a run of three or more ("k y s", "k.y.s"); between longer words they stay word
 * breaks, so "a-b-c" joins but "ab-cd" does not.
 */
export function normalizeForBlocklist(text: string): string {
	const folded = text
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/[​-‏⁠﻿­]/g, '')
		.toLowerCase()
		.replace(/[0134578@$]/g, (c) => LEET[c] ?? c)
		.replace(/(.)\1{2,}/gu, '$1$1');
	const words = folded.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

	const out: string[] = [];
	let run: string[] = [];
	const flush = () => {
		if (run.length >= 3) out.push(run.join(''));
		else out.push(...run);
		run = [];
	};
	for (const word of words) {
		if (word.length === 1) run.push(word);
		else {
			flush();
			out.push(word);
		}
	}
	flush();
	return out.join(' ');
}

/** `MODERATION_EXTRA_TERMS`: comma or newline separated, read when a comment is checked. */
function extraTerms(): string[] {
	const raw = env.MODERATION_EXTRA_TERMS;
	return raw ? raw.split(/[,\n]/) : [];
}

/** A blocklist match: the public term that matched, or `null` for a private extra term. */
export interface BlocklistHit {
	term: string | null;
}

/** The first blocklisted word or phrase the text contains as a whole word, else null. */
export function findBlocklistHit(text: string): BlocklistHit | null {
	const haystack = ` ${normalizeForBlocklist(text)} `;
	const hit = (term: string) => {
		const folded = normalizeForBlocklist(term);
		return folded !== '' && haystack.includes(` ${folded} `);
	};
	const publicTerm = BLOCKLIST_TERMS.find(hit);
	if (publicTerm !== undefined) return { term: publicTerm };
	return extraTerms().some(hit) ? { term: null } : null;
}
