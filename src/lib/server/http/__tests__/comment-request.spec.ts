import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRow } from '#lib/server/data/user-queries.ts';

const rateLimit = vi.fn(async () => {});
const requireUser = vi.fn();
vi.mock('#lib/server/http/rate-limit.ts', () => ({ rateLimit }));
vi.mock('#lib/server/auth/guards.ts', () => ({ requireUser }));

const { authorizeWrite } = await import('../comment-request.ts');

const event = {
	locals: { getUser: async () => null },
	request: new Request('http://localhost/x'),
	getClientAddress: () => ''
};
const account = (over: Partial<UserRow>) => ({ id: 'u1', role: 'user', mutedUntil: null, ...over });

beforeEach(() => {
	rateLimit.mockClear();
	requireUser.mockReset();
});

describe('authorizeWrite', () => {
	it('rate-limits an ordinary user on every bucket', async () => {
		requireUser.mockResolvedValue(account({}));
		await authorizeWrite(event, 'RL_CONTENT_REPORT');
		await authorizeWrite(event, 'RL_COMMENT');
		expect(rateLimit).toHaveBeenCalledTimes(2);
		expect(rateLimit).toHaveBeenCalledWith(event, 'RL_COMMENT', { userId: 'u1' });
	});

	it('skips the rate limit for a moderator and an administrator on every bucket', async () => {
		for (const role of ['moderator', 'administrator'] as const) {
			requireUser.mockResolvedValue(account({ role }));
			await authorizeWrite(event, 'RL_CONTENT_REPORT');
			await authorizeWrite(event, 'RL_COMMENT');
			await authorizeWrite(event, 'RL_VOTE');
		}
		expect(rateLimit).not.toHaveBeenCalled();
	});

	it('still refuses a muted staff account', async () => {
		requireUser.mockResolvedValue(
			account({ role: 'administrator', mutedUntil: new Date(Date.now() + 60_000) })
		);
		await expect(authorizeWrite(event, 'RL_CONTENT_REPORT')).rejects.toMatchObject({
			status: 403
		});
		expect(rateLimit).not.toHaveBeenCalled();
	});
});
