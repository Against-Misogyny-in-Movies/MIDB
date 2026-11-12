import { describe, it, expect } from 'vitest';
import { isLocalOrigin } from '../origin.ts';

describe('isLocalOrigin', () => {
	it.each([
		'http://localhost:5173',
		'http://127.0.0.1:8787',
		'http://[::1]:5173',
		'https://localhost'
	])('accepts %s', (origin) => expect(isLocalOrigin(origin)).toBe(true));

	it.each([
		'https://midb.example',
		'https://localhost.example',
		'http://127.0.0.2',
		'not a url',
		''
	])('refuses %j', (origin) => expect(isLocalOrigin(origin)).toBe(false));
});
