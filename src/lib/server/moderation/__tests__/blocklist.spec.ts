import { describe, it, expect, beforeEach } from 'vitest';
import { env, resetCloudflareStub } from '#test/cloudflare-workers.stub.ts';
import { BLOCKLIST_TERMS, findBlocklistHit, normalizeForBlocklist } from '../blocklist.ts';

beforeEach(resetCloudflareStub);

const hitsBlocklist = (text: string) => findBlocklistHit(text) !== null;

describe('normalizeForBlocklist', () => {
	it('folds case, accents, leetspeak, repeats and separators', () => {
		expect(normalizeForBlocklist('K1LL   Yóurself!!')).toBe('kill yourself');
		expect(normalizeForBlocklist('fuuuuck')).toBe('fuuck');
		expect(normalizeForBlocklist('a-b-c dog')).toBe('abc dog');
		expect(normalizeForBlocklist('z​ero')).toBe('zero');
	});
});

describe('findBlocklistHit', () => {
	it('names a public term and leaves a private one unnamed', () => {
		env.MODERATION_EXTRA_TERMS = 'zorblax';
		expect(findBlocklistHit('you should KYS')).toEqual({ term: 'kys' });
		expect(findBlocklistHit('k1ll y0urs3lf')).toEqual({ term: 'kill yourself' });
		expect(findBlocklistHit('a zorblax appears')).toEqual({ term: null });
		expect(findBlocklistHit('a calm comment')).toBeNull();
	});

	it('keeps words that are names or everyday words in film talk off the public list', () => {
		for (const word of ['chink', 'spic', 'kike']) expect(BLOCKLIST_TERMS).not.toContain(word);
	});

	it('matches a public term as a whole word and through common evasions', () => {
		expect(hitsBlocklist('you should KYS')).toBe(true);
		expect(hitsBlocklist('k.y.s')).toBe(true);
		expect(hitsBlocklist('k y s')).toBe(true);
		expect(hitsBlocklist('Kill   yourself')).toBe(true);
		expect(hitsBlocklist('k1ll y0urs3lf')).toBe(true);
	});

	it('does not match inside a longer word', () => {
		expect(hitsBlocklist('The kysanur forest film is slow')).toBe(false);
		expect(hitsBlocklist('The Bechdel Test passes in the second act.')).toBe(false);
	});

	it('adds the private extra terms, comma or newline separated, read at call time', () => {
		expect(hitsBlocklist('a zorblax appears')).toBe(false);
		env.MODERATION_EXTRA_TERMS = 'foo bar,\nzorblax\n';
		expect(hitsBlocklist('a Z0RBLAX appears')).toBe(true);
		expect(hitsBlocklist('the foo bar scene')).toBe(true);
		expect(hitsBlocklist('the scene')).toBe(false);
	});

	it('ignores blank extra terms', () => {
		env.MODERATION_EXTRA_TERMS = ',,\n ,';
		expect(hitsBlocklist('any comment')).toBe(false);
	});
});
