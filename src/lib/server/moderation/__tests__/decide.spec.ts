import { describe, it, expect, vi, beforeEach } from 'vitest';
import { env, resetCloudflareStub } from '#test/cloudflare-workers.stub.ts';

const classifyComment = vi.fn();
vi.mock('../classify.ts', () => ({ classifyComment }));

const { decideStatus } = await import('../decide.ts');

const input = { body: 'A comment', titleName: 'Alien', kind: 'movie' } as const;
const verdict = (over: object = {}) => ({
	decision: 'allow',
	categories: [],
	severity: 0,
	reason: 'On topic.',
	...over
});

beforeEach(() => {
	resetCloudflareStub();
	classifyComment.mockReset();
	env.PUBLIC_ORIGIN = 'http://localhost:5173';
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('decideStatus', () => {
	it('rejects a blocklist hit without calling the classifier', async () => {
		env.MODERATION_EXTRA_TERMS = 'zorblax';
		const result = await decideStatus({ ...input, body: 'you zorblax' });
		expect(result).toMatchObject({ status: 'rejected', source: 'blocklist', aiVerdict: null });
		expect(result.reason).toBeTruthy();
		expect(classifyComment).not.toHaveBeenCalled();
	});

	it('names a public blocklist term in the reason and keeps a private one unnamed', async () => {
		const publicHit = await decideStatus({ ...input, body: 'just KYS' });
		expect(publicHit.reason).toBe('The comment contains "kys", which the site does not allow.');
		env.MODERATION_EXTRA_TERMS = 'zorblax';
		const privateHit = await decideStatus({ ...input, body: 'you zorblax' });
		expect(privateHit.reason).toBe(
			'The comment contains a word or phrase the site does not allow.'
		);
		expect(privateHit.reason).not.toContain('zorblax');
	});

	it('publishes an allow verdict and stores the verdict JSON with the model', async () => {
		classifyComment.mockResolvedValue({ ok: true, verdict: verdict(), model: 'claude-haiku-5-5' });
		const result = await decideStatus(input);
		expect(result).toMatchObject({ status: 'published', source: 'ai', reason: null });
		expect(JSON.parse(result.aiVerdict ?? '')).toEqual({ ...verdict(), model: 'claude-haiku-5-5' });
	});

	it('rejects a severe reject verdict with its reason, and holds a mild one', async () => {
		const reject = (severity: number) => ({
			ok: true,
			model: 'm',
			verdict: verdict({ decision: 'reject', severity, categories: ['slur'], reason: 'A slur.' })
		});
		classifyComment.mockResolvedValueOnce(reject(3));
		expect(await decideStatus(input)).toMatchObject({
			status: 'rejected',
			source: 'ai',
			reason: 'A slur.'
		});
		classifyComment.mockResolvedValueOnce(reject(1));
		expect(await decideStatus(input)).toMatchObject({ status: 'pending', source: 'ai' });
	});

	it('holds a failed check and stores its code', async () => {
		classifyComment.mockResolvedValue({ ok: false, code: 'ai-timeout' });
		const result = await decideStatus(input);
		expect(result).toMatchObject({ status: 'pending', source: null, reason: null });
		expect(JSON.parse(result.aiVerdict ?? '')).toEqual({ failure: 'ai-timeout' });
	});

	it('holds a comment for a moderator when there is no key', async () => {
		classifyComment.mockResolvedValue({ ok: false, code: 'ai-unavailable' });
		await expect(decideStatus(input)).resolves.toEqual({
			status: 'pending',
			source: null,
			reason: null,
			aiVerdict: null
		});
	});

	describe('MODERATION_DEV_AUTO_APPROVE', () => {
		beforeEach(() => {
			classifyComment.mockResolvedValue({ ok: false, code: 'ai-unavailable' });
			env.MODERATION_DEV_AUTO_APPROVE = '1';
		});

		it('publishes an unchecked comment on localhost', async () => {
			await expect(decideStatus(input)).resolves.toEqual({
				status: 'published',
				source: null,
				reason: null,
				aiVerdict: null
			});
		});

		it('is refused off localhost', async () => {
			env.PUBLIC_ORIGIN = 'https://midb.example';
			await expect(decideStatus(input)).resolves.toMatchObject({ status: 'pending' });
		});

		it('does not override a failed check when a key is set', async () => {
			classifyComment.mockResolvedValue({ ok: false, code: 'ai-error' });
			await expect(decideStatus(input)).resolves.toMatchObject({ status: 'pending' });
		});

		it('still applies the blocklist', async () => {
			env.MODERATION_EXTRA_TERMS = 'zorblax';
			await expect(decideStatus({ ...input, body: 'zorblax' })).resolves.toMatchObject({
				status: 'rejected'
			});
		});
	});
});
