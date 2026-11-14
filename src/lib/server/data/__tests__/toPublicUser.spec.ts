import { describe, it, expect, vi } from 'vitest';
import type { UserRow } from '#lib/server/data/user-queries.ts';

// toPublicUser is pure; stub the DB client so importing the module opens no connection.
vi.mock('#lib/server/db.ts', () => ({ db: {} }));

const { displayNameOf, toPublicUser } = await import('#lib/server/data/user-queries.ts');

function row(overrides: Partial<UserRow> = {}): UserRow {
	return {
		id: 'user-1',
		name: 'Mary',
		email: 'mary@example.com',
		emailVerified: true,
		image: null,
		role: 'user',
		username: null,
		avatarKey: null,
		bannedAt: null,
		banReason: null,
		mutedUntil: null,
		usernameChangedAt: null,
		usernameFolded: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides
	};
}

describe('toPublicUser', () => {
	it('keeps only the public fields: the opaque id, no email, no timestamps', () => {
		const pub = toPublicUser(row({ username: 'mary', avatarKey: 'kahlo', role: 'moderator' }));
		expect(pub).toEqual({
			id: 'user-1',
			username: 'mary',
			avatarKey: 'kahlo',
			role: 'moderator',
			displayName: 'mary'
		});
		expect(Object.keys(pub).sort()).toEqual(['avatarKey', 'displayName', 'id', 'role', 'username']);
		expect(JSON.stringify(pub)).not.toContain('example.com');
	});

	it('displayName prefers the username', () => {
		expect(toPublicUser(row({ username: 'mary' })).displayName).toBe('mary');
	});

	it('never derives a name from the email', () => {
		const pub = toPublicUser(row({ username: null, email: 'mary@example.com' }));
		expect(pub.displayName).toBe('Account');
		expect(JSON.stringify(pub)).not.toContain('@');
	});

	it('shows Account for a row with no username, a placeholder email included', () => {
		const pub = toPublicUser(row({ username: null, email: 'abc-123@users.invalid' }));
		expect(pub.displayName).toBe('Account');
		expect(JSON.stringify(pub)).not.toMatch(/abc-123|invalid/);
	});
});

describe('displayNameOf', () => {
	it('is the username, and "Account" for none, which toPublicUser shares', () => {
		expect(displayNameOf('mary')).toBe('mary');
		expect(displayNameOf(null)).toBe('Account');
		expect(displayNameOf(undefined)).toBe('Account');
		expect(displayNameOf('')).toBe('Account');
		expect(toPublicUser(row({ username: null })).displayName).toBe(displayNameOf(null));
	});
});
