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

	it('sees through format characters and variation selectors', () => {
		expect(hitsBlocklist('k\u200Dy\u200Cs')).toBe(true);
		expect(hitsBlocklist('ki\u2060ll yours\u00ADelf')).toBe(true);
		expect(hitsBlocklist('k\uFE0Fy\uFE0Es')).toBe(true);
		expect(hitsBlocklist('kill\u202E yourself')).toBe(true);
	});

	it('folds Cyrillic and Greek look-alikes to their Latin letter', () => {
		expect(hitsBlocklist('\u043A\u0443\u0455')).toBe(true);
		expect(hitsBlocklist('kill yo\u03C5rself')).toBe(true);
		expect(hitsBlocklist('\u03BAill yourself')).toBe(true);
		expect(hitsBlocklist('f\u0430ggot')).toBe(true);
		expect(hitsBlocklist('n\u0456gger')).toBe(true);
		expect(hitsBlocklist('tr\u0430nny')).toBe(true);
	});

	it('matches a term with a trailing s or es', () => {
		expect(hitsBlocklist('those faggots')).toBe(true);
		expect(hitsBlocklist('two kyses')).toBe(true);
		expect(hitsBlocklist('the niggas')).toBe(true);
		expect(hitsBlocklist('The kysanur forest film is slow')).toBe(false);
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
