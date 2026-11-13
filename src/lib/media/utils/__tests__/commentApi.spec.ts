import { describe, expect, it, vi } from 'vitest';
import { describeFailure, describeStatus, requestJson } from '../commentApi.ts';

describe('requestJson', () => {
	it('returns no data for a 204', async () => {
		const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
		expect(await requestJson<undefined>(fetcher, 'DELETE', '/x')).toEqual({
			ok: true,
			status: 204,
			data: undefined
		});
	});

	it('keeps the message of a failed response and reads a network failure as status 0', async () => {
		const failed = vi.fn(async () => Response.json({ message: 'muted' }, { status: 403 }));
		expect(await requestJson(failed, 'GET', '/x')).toEqual({
			ok: false,
			status: 403,
			message: 'muted'
		});
		const down = vi.fn(async () => {
			throw new Error('offline');
		});
		expect(await requestJson(down, 'GET', '/x')).toMatchObject({ ok: false, status: 0 });
	});
});

describe('describeStatus', () => {
	const wording = { forbidden: 'No.', badRequest: 'Bad.', notFound: 'Gone.' };

	it('words the shared statuses with what failed and the rest from the wording', () => {
		expect(describeStatus('It failed', 0, wording)).toBe(
			'It failed. The server could not be reached.'
		);
		expect(describeStatus('It failed', 401, wording)).toContain('sign in again');
		expect(describeStatus('It failed', 403, wording)).toBe('No.');
		expect(describeStatus('It failed', 400, wording)).toBe('Bad.');
		expect(describeStatus('It failed', 404, wording)).toBe('Gone.');
		expect(describeStatus('It failed', 409, wording)).toBe('It failed. Try again in a moment.');
		expect(describeStatus('It failed', 429, wording)).toContain('Too many requests');
	});
});

describe('describeFailure', () => {
	it('names a muted or banned account before the action', () => {
		expect(describeFailure('create', 403, 'Account muted')).toMatch(/is muted/);
		expect(describeFailure('vote', 403, 'banned')).toMatch(/is banned/);
		expect(describeFailure('vote', 403)).toBe('A comment cannot be voted on by its author.');
		expect(describeFailure('edit', 403)).toBe('Only the author can change a comment.');
	});

	it('words a rejected comment and a rejected report differently', () => {
		expect(describeFailure('create', 400)).toBe(
			'The comment was not posted. A comment is 1 to 5,000 characters.'
		);
		expect(describeFailure('report', 400)).toMatch(/A note is at most/);
		expect(describeFailure('edit', 409)).toMatch(/Reload the page/);
	});
});
