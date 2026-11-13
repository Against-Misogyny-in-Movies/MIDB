import { describe, expect, it } from 'vitest';
import { canActOn } from '../canActOn.ts';

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
