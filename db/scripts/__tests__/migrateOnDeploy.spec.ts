import { describe, expect, it, vi } from 'vitest';

vi.mock('../migrate', () => ({ migrateDatabase: vi.fn() }));

const { deployMigration } = await import('$db/scripts/migrateOnDeploy');

const URL = 'postgres://user:secret@db.example.com:5432/midb';

describe('deployMigration', () => {
	it('migrates DB_CONNECTION on Production builds', () => {
		expect(deployMigration({ VERCEL_ENV: 'production', DB_CONNECTION: URL })).toEqual({
			url: URL
		});
	});

	it('skips previews, development and builds outside Vercel', () => {
		for (const VERCEL_ENV of ['preview', 'development', undefined]) {
			expect(deployMigration({ VERCEL_ENV, DB_CONNECTION: URL })).toHaveProperty('skip');
		}
	});

	it('fails a Production build without DB_CONNECTION', () => {
		expect(() => deployMigration({ VERCEL_ENV: 'production' })).toThrow(/DB_CONNECTION/);
	});
});
