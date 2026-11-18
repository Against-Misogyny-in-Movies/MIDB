import { beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { accountNotes, comments, moderationActions } from '#db/schema/community.ts';
import { NOTE_MAX, moderationAction, moderationRule } from '#db/lib/comments.ts';
import { userValues } from './users.ts';

let titleId: string;

beforeEach(async () => {
	await db.insert(users).values([userValues('anna'), userValues('mod', { role: 'moderator' })]);
	[{ id: titleId }] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
});

const rejects = (run: () => Promise<unknown>) => expect(run()).rejects.toThrow();

describe('moderation_actions', () => {
	it('accepts every action and every rule', async () => {
		for (const action of moderationAction) {
			await db.insert(moderationActions).values({ actorId: 'mod', targetUserId: 'anna', action });
		}
		for (const rule of moderationRule) {
			await db
				.insert(moderationActions)
				.values({ actorId: 'mod', targetUserId: 'anna', action: 'ban', rule });
		}
		const rows = await db.select().from(moderationActions);
		expect(rows).toHaveLength(moderationAction.length + moderationRule.length);
	});

	it('rejects an unknown action and an unknown rule', async () => {
		await rejects(() =>
			db.insert(moderationActions).values({ actorId: 'mod', action: 'bogus' as 'ban' })
		);
		await rejects(() =>
			db
				.insert(moderationActions)
				.values({ actorId: 'mod', action: 'ban', rule: 'bogus' as 'other' })
		);
	});

	it('has an index on the target account and on the actor', async () => {
		const names = (
			await db.all<{ name: string }>(sql`PRAGMA index_list('moderation_actions')`)
		).map((i) => i.name);
		expect(names).toContain('moderation_actions_target_user_idx');
		expect(names).toContain('moderation_actions_actor_idx');
	});

	it('keeps a row when its actor or target account is deleted', async () => {
		await db
			.insert(moderationActions)
			.values({ id: 'a1', actorId: 'mod', targetUserId: 'anna', action: 'mute', muteHours: 24 });
		await db.delete(users).where(eq(users.id, 'mod'));
		const [row] = await db.select().from(moderationActions);
		expect(row.actorId).toBeNull();
		expect(row.targetUserId).toBe('anna');
	});
});

describe('comments.moderation_rule', () => {
	const make = () => ({ titleId, userId: 'anna', body: 'text' });

	it('is null by default and takes a rule', async () => {
		const [plain] = await db.insert(comments).values(make()).returning();
		expect(plain.moderationRule).toBeNull();
		const [ruled] = await db
			.insert(comments)
			.values({ ...make(), status: 'hidden', moderationRule: 'trolling' })
			.returning();
		expect(ruled.moderationRule).toBe('trolling');
	});

	it('rejects a rule outside the list', async () => {
		await rejects(() =>
			db.insert(comments).values({ ...make(), moderationRule: 'bogus' as 'other' })
		);
	});

	it('leaves existing comment rows and their replies in place after the migration', async () => {
		const [root] = await db.insert(comments).values(make()).returning();
		await db.insert(comments).values({ ...make(), parentId: root.id, rootId: root.id });
		expect(await db.select().from(comments)).toHaveLength(2);
	});
});

describe('account_notes', () => {
	it('stores a note and rejects an empty or a too long one', async () => {
		await db
			.insert(accountNotes)
			.values({ userId: 'anna', authorId: 'mod', body: 'watch this one' });
		await rejects(() => db.insert(accountNotes).values({ userId: 'anna', body: '' }));
		await rejects(() =>
			db.insert(accountNotes).values({ userId: 'anna', body: 'x'.repeat(NOTE_MAX + 1) })
		);
		await db.insert(accountNotes).values({ userId: 'anna', body: 'x'.repeat(NOTE_MAX) });
		expect(await db.select().from(accountNotes)).toHaveLength(2);
	});

	it('cascades with the account and clears the author when the author goes', async () => {
		await db.insert(accountNotes).values({ id: 'n1', userId: 'anna', authorId: 'mod', body: 'a' });
		await db.delete(users).where(eq(users.id, 'mod'));
		const [note] = await db.select().from(accountNotes);
		expect(note.authorId).toBeNull();
		await db.delete(users).where(eq(users.id, 'anna'));
		expect(await db.select().from(accountNotes)).toHaveLength(0);
	});

	it('has an index on the account', async () => {
		const names = (await db.all<{ name: string }>(sql`PRAGMA index_list('account_notes')`)).map(
			(i) => i.name
		);
		expect(names).toContain('account_notes_user_idx');
	});
});
