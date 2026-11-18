import { describe, expect, it } from 'vitest';
import { canActOn, canCloseFlag, canEndMute, canLiftBan, canReopenFlag } from '../canActOn.ts';

const user = { id: 'u', role: 'user' };
const mod = { id: 'm', role: 'moderator' };
const mod2 = { id: 'm2', role: 'moderator' };
const admin = { id: 'a', role: 'administrator' };
const admin2 = { id: 'a2', role: 'administrator' };

describe('canActOn', () => {
	it('lets a moderator act on an ordinary account only', () => {
		expect(canActOn(mod, user)).toBe(true);
		expect(canActOn(mod, user, 'restrict')).toBe(true);
		for (const target of [mod, mod2, admin]) {
			expect(canActOn(mod, target)).toBe(false);
			expect(canActOn(mod, target, 'restrict')).toBe(false);
		}
	});

	it('lets an administrator act on any account, their own and other administrators’ included', () => {
		for (const target of [user, mod, admin, admin2]) expect(canActOn(admin, target)).toBe(true);
		for (const target of [user, mod, admin2])
			expect(canActOn(admin, target, 'restrict')).toBe(true);
	});

	it('refuses an administrator muting or banning themselves, and nothing else', () => {
		expect(canActOn(admin, admin, 'restrict')).toBe(false);
		expect(canActOn(admin, admin, 'moderate')).toBe(true);
		expect(canActOn(admin, admin)).toBe(true);
	});
});

describe('canCloseFlag', () => {
	it('refuses a moderator their own flag and an administrator’s, and lets them close anyone else’s', () => {
		expect(canCloseFlag(mod, mod)).toBe(false);
		expect(canCloseFlag(mod, admin)).toBe(false);
		for (const reporter of [user, mod2]) expect(canCloseFlag(mod, reporter)).toBe(true);
	});

	it('lets an administrator close any flag, their own included', () => {
		for (const reporter of [user, mod, admin, admin2])
			expect(canCloseFlag(admin, reporter)).toBe(true);
	});
});

describe('canEndMute', () => {
	it('lets an administrator end any mute, and a moderator only a moderator’s on an ordinary account', () => {
		expect(canEndMute(admin, user, false)).toBe(true);
		expect(canEndMute(mod, user, false)).toBe(false);
		expect(canEndMute(mod, user, true)).toBe(true);
		expect(canEndMute(mod, mod2, true)).toBe(false);
		expect(canEndMute(admin, admin, false)).toBe(false);
	});
});

describe('canLiftBan', () => {
	it('is for administrators on other accounts only', () => {
		expect(canLiftBan(admin, user)).toBe(true);
		expect(canLiftBan(mod, user)).toBe(false);
		expect(canLiftBan(admin, admin)).toBe(false);
	});
});

describe('canReopenFlag', () => {
	it('adds, for a moderator, that no administrator closed the flag', () => {
		expect(canReopenFlag(mod, user, false)).toBe(true);
		expect(canReopenFlag(mod, user, true)).toBe(false);
		expect(canReopenFlag(mod, admin, false)).toBe(false);
		expect(canReopenFlag(admin, user, true)).toBe(true);
		expect(canReopenFlag(admin, admin, true)).toBe(true);
	});
});
