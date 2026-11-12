import { describe, it, expect, vi } from 'vitest';
import type { UserRow } from '#lib/server/data/user-queries.ts';

// toPublicUser is pure; stub the DB client so importing the module opens no connection.
vi.mock('#lib/server/db.ts', () => ({ db: {} }));

const { toPublicUser } = await import('#lib/server/data/user-queries.ts');

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

	it('falls back to the email local-part without exposing the domain', () => {
		const pub = toPublicUser(row({ username: null, email: 'mary@example.com' }));
		expect(pub.displayName).toBe('mary');
		expect(JSON.stringify(pub)).not.toContain('@');
	});

	it('never shows the placeholder email of a passkey-only account', () => {
		const pub = toPublicUser(row({ username: null, email: 'abc-123@users.invalid' }));
		expect(pub.displayName).toBe('Account');
		expect(JSON.stringify(pub)).not.toMatch(/abc-123|invalid/);
	});

	it('treats an empty local-part as missing', () => {
		expect(toPublicUser(row({ username: null, email: '@example.com' })).displayName).toBe(
			'Account'
		);
	});
});
