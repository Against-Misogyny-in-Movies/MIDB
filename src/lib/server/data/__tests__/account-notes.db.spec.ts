import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { chunkForD1 } from '#db/lib/chunkForD1.ts';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { accountNotes, moderationActions } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { NOTE_MAX } from '#lib/media/utils/comments.ts';
import { NOTES_SHOWN, addAccountNote, listAccountNotes } from '../account-notes.ts';
import { scrubAccount } from '../account-scrub.ts';
import { getUserById, type UserRow } from '../user-queries.ts';

let mod: UserRow;
let admin: UserRow;

beforeEach(async () => {
	await db
		.insert(users)
		.values([
			userValues('mod', { role: 'moderator', username: 'mod_one' }),
			userValues('mod2', { role: 'moderator', username: 'mod_two' }),
			userValues('admin', { role: 'administrator', username: 'admin_one' }),
			userValues('target', { username: 'target_1' })
		]);
	mod = (await getUserById('mod'))!;
	admin = (await getUserById('admin'))!;
});

const notes = () => db.select().from(accountNotes);
const log = () => db.select().from(moderationActions).where(eq(moderationActions.action, 'note'));

describe('addAccountNote', () => {
	it('stores the note with its author and logs a note action that does not carry the text', async () => {
		expect(await addAccountNote(mod, 'target', '  Second warning.  ')).toEqual({
			ok: true,
			title: null
		});
		const [note] = await notes();
		expect(note).toMatchObject({ userId: 'target', authorId: 'mod', body: 'Second warning.' });
		const [row] = await log();
		expect(row).toMatchObject({
			actorId: 'mod',
			targetUserId: 'target',
			action: 'note',
			reason: null,
			rule: null
		});
		expect(JSON.stringify(row)).not.toContain('Second warning');
	});

	it('refuses a note that is empty after trimming or past the limit, writing nothing', async () => {
		expect(await addAccountNote(mod, 'target', '   ')).toEqual({ ok: false, reason: 'invalid' });
		expect(await addAccountNote(mod, 'target', 'x'.repeat(NOTE_MAX + 1))).toEqual({
			ok: false,
			reason: 'invalid'
		});
		expect(await notes()).toHaveLength(0);
		expect(await log()).toHaveLength(0);
	});

	it('accepts a note of exactly the limit', async () => {
		expect(await addAccountNote(mod, 'target', 'x'.repeat(NOTE_MAX))).toMatchObject({ ok: true });
	});

	it('refuses an unknown or deleted account as not found', async () => {
		expect(await addAccountNote(mod, 'nobody', 'hi')).toEqual({ ok: false, reason: 'not-found' });
		await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, 'target'));
		expect(await addAccountNote(mod, 'target', 'hi')).toEqual({ ok: false, reason: 'not-found' });
		expect(await notes()).toHaveLength(0);
	});

	it('follows canActOn: a moderator cannot note an administrator, another moderator or themselves, an administrator can note anyone', async () => {
		for (const target of ['admin', 'mod2', 'mod']) {
			expect(await addAccountNote(mod, target, 'hi')).toEqual({
				ok: false,
				reason: 'forbidden-target'
			});
		}
		expect(await notes()).toHaveLength(0);
		for (const target of ['mod', 'admin', 'target']) {
			expect(await addAccountNote(admin, target, 'hi')).toMatchObject({ ok: true });
		}
		expect(await notes()).toHaveLength(3);
	});
});

describe('listAccountNotes', () => {
	it('lists the newest first with the author, and counts them all', async () => {
		await db.insert(accountNotes).values([
			{ id: 'n1', userId: 'target', authorId: 'mod', body: 'first', createdAt: new Date(1000) },
			{ id: 'n2', userId: 'target', authorId: 'admin', body: 'second', createdAt: new Date(2000) },
			{ id: 'n3', userId: 'mod', authorId: 'admin', body: 'elsewhere' }
		]);
		const { notes: rows, total } = await listAccountNotes('target');
		expect(total).toBe(2);
		expect(rows.map((n) => [n.body, n.author, n.authorId])).toEqual([
			['second', 'admin_one', 'admin'],
			['first', 'mod_one', 'mod']
		]);
	});

	it('keeps a note whose author is gone, with no author', async () => {
		await addAccountNote(mod, 'target', 'kept');
		await db.delete(users).where(eq(users.id, 'mod'));
		const { notes: rows } = await listAccountNotes('target');
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ body: 'kept', author: null, authorId: null });
	});

	it('shows the newest few and reports the total', async () => {
		const rows = Array.from({ length: NOTES_SHOWN + 4 }, (_, i) => ({
			id: `n${String(i).padStart(3, '0')}`,
			userId: 'target',
			authorId: 'mod',
			body: `note ${i}`,
			createdAt: new Date(1000 + i)
		}));
		for (const chunk of chunkForD1(rows, 7)) await db.insert(accountNotes).values(chunk);
		const { notes: shown, total } = await listAccountNotes('target');
		expect(shown).toHaveLength(NOTES_SHOWN);
		expect(total).toBe(NOTES_SHOWN + 4);
		expect(shown[0].body).toBe(`note ${NOTES_SHOWN + 3}`);
	});

	it('goes with the account when it is deleted, while the log row stays', async () => {
		await addAccountNote(mod, 'target', 'gone soon');
		await scrubAccount('target');
		expect(await notes()).toHaveLength(0);
		expect(await log()).toHaveLength(1);
	});
});
