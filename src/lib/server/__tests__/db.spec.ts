import { describe, it, expect, vi, afterEach } from 'vitest';

const env: Record<string, string | undefined> = {};
vi.mock('$env/dynamic/private', () => ({ env }));

const createDb = vi.fn(() => ({ db: { marker: 'db' }, sql: { end: vi.fn() } }));
vi.mock('$db/client', () => ({ createDb }));

const { db, closeDb } = await import('$lib/server/db');

afterEach(async () => {
	await closeDb();
	vi.unstubAllEnvs();
	createDb.mockClear();
	for (const key of Object.keys(env)) delete env[key];
});

describe('$lib/server/db', () => {
	it('opens no connection on import', () => {
		expect(createDb).not.toHaveBeenCalled();
	});

	it('throws a clear error on first use when DB_CONNECTION is unset', () => {
		vi.stubEnv('VITEST', '');
		expect(() => db.select).toThrow('DB_CONNECTION is not set');
		expect(createDb).not.toHaveBeenCalled();
	});

	it('has no localhost fallback outside tests', () => {
		vi.stubEnv('VITEST', '');
		env.TEST_DB_CONNECTION = 'postgres://test';
		expect(() => db.select).toThrow('DB_CONNECTION is not set');
	});

	it('connects lazily to DB_CONNECTION, once', () => {
		vi.stubEnv('VITEST', '');
		env.DB_CONNECTION = 'postgres://runtime';
		expect((db as unknown as { marker: string }).marker).toBe('db');
		expect((db as unknown as { marker: string }).marker).toBe('db');
		expect(createDb).toHaveBeenCalledOnce();
		expect(createDb).toHaveBeenCalledWith('postgres://runtime');
	});

	it('under Vitest reads TEST_DB_CONNECTION only, never DB_CONNECTION', () => {
		env.DB_CONNECTION = 'postgres://dev';
		expect(() => db.select).toThrow('TEST_DB_CONNECTION is not set');
		env.TEST_DB_CONNECTION = 'postgres://test';
		expect((db as unknown as { marker: string }).marker).toBe('db');
		expect(createDb).toHaveBeenCalledWith('postgres://test');
	});
});
