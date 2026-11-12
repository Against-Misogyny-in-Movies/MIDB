import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { env } from 'cloudflare:workers';
import { resetCloudflareStub } from '#test/cloudflare-workers.stub.ts';

const createDb = vi.fn((d1: unknown) => ({ marker: 'db', d1 }));
vi.mock('#db/client.ts', () => ({ createDb }));

const { db, bindDb } = await import('#lib/server/db.ts');

const marker = () => (db as unknown as { marker: string }).marker;
const d1 = (name: string) => ({ name }) as unknown as D1Database;

beforeEach(() => {
	resetCloudflareStub();
	createDb.mockClear();
});

afterEach(() => bindDb(undefined));

describe('#lib/server/db.ts', () => {
	it('builds no client on import', () => {
		expect(createDb).not.toHaveBeenCalled();
	});

	it('throws a clear error on first use when the DB binding is missing', () => {
		expect(() => db.select).toThrow('The D1 binding "DB" is not available');
		expect(createDb).not.toHaveBeenCalled();
	});

	it('builds the client lazily from env.DB, once per binding', () => {
		const binding = d1('worker');
		env.DB = binding;
		expect(marker()).toBe('db');
		expect(marker()).toBe('db');
		expect(createDb).toHaveBeenCalledOnce();
		expect(createDb).toHaveBeenCalledWith(binding);
	});

	it('bindDb overrides env.DB, and undefined restores it', () => {
		env.DB = d1('worker');
		const override = d1('override');
		bindDb(override);
		expect(marker()).toBe('db');
		expect(createDb).toHaveBeenLastCalledWith(override);
		bindDb(undefined);
		expect(marker()).toBe('db');
		expect(createDb).toHaveBeenLastCalledWith(env.DB);
	});
});
