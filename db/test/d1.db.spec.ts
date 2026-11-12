import { describe, it, expect } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { titles } from '#db/schema/titles.ts';
import { users } from '#db/schema/auth.ts';
import { comments, communityBechdelRatings } from '#db/schema/community.ts';
import { db } from '#lib/server/db.ts';
import { trackWrites, writes } from './writes.ts';

// What the app relies on from D1 and Drizzle's SQLite dialect, checked against the real thing.

const movie = (tmdbId: number) => ({
	kind: 'movie' as const,
	title: `Film ${tmdbId}`,
	cleanTitle: `film ${tmdbId}`,
	tmdbId
});

describe('D1 through Drizzle', () => {
	it('fills ids and timestamps on insert and returns them', async () => {
		const [row] = await db.insert(titles).values(movie(1)).returning();
		expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(row.createdAt).toBeInstanceOf(Date);
		expect(row.popularity).toBeNull();
	});

	it('rejects values outside an enum column, which is checked in the database', async () => {
		await expect(
			db.insert(titles).values({ ...movie(1), kind: 'show' as 'movie' })
		).rejects.toThrow();
		await db.insert(users).values({ id: 'u1' });
		await expect(
			db
				.update(users)
				.set({ role: 'owner' as 'user' })
				.where(eq(users.id, 'u1'))
		).rejects.toThrow();
	});

	it('rejects text over the length limits the schema keeps from Postgres', async () => {
		const long = (n: number) => 'x'.repeat(n);
		await expect(db.insert(titles).values({ ...movie(1), title: long(256) })).rejects.toThrow();
		await expect(
			db.insert(titles).values({ ...movie(1), cleanTitle: long(256) })
		).rejects.toThrow();
		await db.insert(titles).values({ ...movie(1), title: long(255), cleanTitle: long(255) });
		await expect(db.insert(users).values({ id: 'u1', username: long(33) })).rejects.toThrow();
		await expect(db.insert(users).values({ id: 'u1', avatarKey: long(49) })).rejects.toThrow();
		await db.insert(users).values({ id: 'u1', username: long(32), avatarKey: long(48) });
	});

	it('enforces foreign keys and cascades deletes', async () => {
		await expect(
			db.insert(communityBechdelRatings).values({ userId: 'nobody', titleId: 'none', rating: 1 })
		).rejects.toThrow();

		await db.insert(users).values({ id: 'u1' });
		const [title] = await db.insert(titles).values(movie(2)).returning();
		await db.insert(comments).values({ userId: 'u1', titleId: title.id, body: 'x' });
		await db.delete(titles).where(eq(titles.id, title.id));
		expect(await db.select().from(comments)).toEqual([]);
	});

	it('upserts with excluded.* and ignores a conflict with onConflictDoNothing', async () => {
		await db.insert(titles).values({ ...movie(3), imdbId: 'tt1' });
		await db
			.insert(titles)
			.values({ ...movie(4), imdbId: 'tt1', title: 'Renamed' })
			.onConflictDoUpdate({ target: titles.imdbId, set: { title: sql`excluded.title` } });
		const [row] = await db.select().from(titles).where(eq(titles.imdbId, 'tt1'));
		expect(row).toMatchObject({ title: 'Renamed', tmdbId: 3 });

		const ignored = await db
			.insert(titles)
			.values({ ...movie(5), imdbId: 'tt1' })
			.onConflictDoNothing()
			.returning();
		expect(ignored).toEqual([]);
	});

	it('treats NULL tmdb_id rows as distinct in the (kind, tmdb_id) key', async () => {
		await db.insert(titles).values({ ...movie(0), tmdbId: null, title: 'A' });
		await db.insert(titles).values({ ...movie(0), tmdbId: null, title: 'B' });
		expect(await db.select().from(titles)).toHaveLength(2);
	});

	it('batch() is atomic: a failing statement rolls the others back', async () => {
		await db.insert(titles).values({ ...movie(6), imdbId: 'tt6' });
		await expect(
			db.batch([
				db.insert(titles).values({ ...movie(7), imdbId: 'tt7' }),
				db.insert(titles).values({ ...movie(8), imdbId: 'tt6' })
			])
		).rejects.toThrow();
		expect(await db.select().from(titles).where(eq(titles.imdbId, 'tt7'))).toEqual([]);
	});

	it('has no transactions: db.transaction() fails', async () => {
		await expect(db.transaction(async (tx) => tx.select().from(titles))).rejects.toThrow();
	});

	it('logs inserts, updates and deletes on a tracked table, and nothing for a read', async () => {
		await trackWrites('user');
		const before = await writes();
		await db.insert(users).values({ id: 'u1' });
		await db.update(users).set({ username: 'ada' }).where(eq(users.id, 'u1'));
		await db.delete(users).where(eq(users.id, 'u1'));
		expect(await writes()).toBe(before + 3);
		await db.select().from(users);
		expect(await writes()).toBe(before + 3);
	});
});
