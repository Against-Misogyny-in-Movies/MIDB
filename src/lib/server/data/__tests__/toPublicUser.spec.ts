import { describe, it, expect, vi } from 'vitest';
import type { UserRow } from '$lib/server/data/user-queries';

// toPublicUser is pure; stub the DB client so importing the module opens no connection.
vi.mock('$db/connections', () => ({ default: {} }));

const { toPublicUser } = await import('$lib/server/data/user-queries');

function row(overrides: Partial<UserRow> = {}): UserRow {
	return {
		id: 'hanko-sub-1',
		email: 'mary@example.com',
		role: 'user',
		username: null,
		avatarKey: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides
	} as UserRow;
}

describe('toPublicUser', () => {
	it('keeps only the public fields: no email, no id, no timestamps', () => {
		const pub = toPublicUser(row({ username: 'mary', avatarKey: 'kahlo', role: 'moderator' }));
		expect(pub).toEqual({
			username: 'mary',
			avatarKey: 'kahlo',
			role: 'moderator',
			displayName: 'mary'
		});
		expect(Object.keys(pub).sort()).toEqual(['avatarKey', 'displayName', 'role', 'username']);
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

	it('falls back to "Account" with neither username nor email', () => {
		expect(toPublicUser(row({ username: null, email: null })).displayName).toBe('Account');
	});

	it('treats an empty local-part as missing', () => {
		expect(toPublicUser(row({ username: null, email: '@example.com' })).displayName).toBe(
			'Account'
		);
	});
});
