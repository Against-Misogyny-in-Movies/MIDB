import { env } from '#lib/server/env.ts';

/**
 * The public blocklist: whole words and phrases that reject a comment without a model call.
 * It is short on purpose. The model, the reports and the moderators handle the rest, and a
 * private `MODERATION_EXTRA_TERMS` secret adds terms at runtime.
 */
export const BLOCKLIST_TERMS: readonly string[] = [
	'nigger',
	'nigga',
	'faggot',
	'kike',
	'chink',
	'spic',
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
 * the terms: case, accents and look-alike letters (NFKD), zero-width characters, leetspeak,
 * punctuation between letters, runs of three or more of one letter, and letters spaced out one
 * by one ("k y s").
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

/** Whether the text contains a blocklisted word or phrase, as a whole word. */
export function hitsBlocklist(text: string): boolean {
	const haystack = ` ${normalizeForBlocklist(text)} `;
	return [...BLOCKLIST_TERMS, ...extraTerms()]
		.map(normalizeForBlocklist)
		.some((term) => term !== '' && haystack.includes(` ${term} `));
}
