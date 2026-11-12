import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireUser = vi.fn();
const getUserComments = vi.fn();

vi.mock('#lib/server/auth/guards.ts', () => ({
	requireUser: (...args: unknown[]) => requireUser(...args)
}));
vi.mock('#lib/server/data/user-queries.ts', () => ({
	getUserComments: (...args: unknown[]) => getUserComments(...args)
}));

const { load } = await import('../+page.server');

describe('/user/comments load', () => {
	beforeEach(() => {
		requireUser.mockReset().mockResolvedValue({ id: 'user-1' });
		getUserComments.mockReset();
	});

	it('requires a user, as a page', async () => {
		getUserComments.mockResolvedValue([]);
		await load({ locals: {} } as Parameters<typeof load>[0]);
		expect(requireUser).toHaveBeenCalledWith({}, { page: true });
	});

	it('returns the comments of that user in every status, with ISO dates', async () => {
		getUserComments.mockResolvedValue(
			(['pending', 'published', 'hidden', 'rejected', 'deleted'] as const).map((status, i) => ({
				id: `c${i}`,
				body: 'text',
				status,
				createdAt: new Date('2026-11-01T10:00:00.000Z'),
				editedAt: i === 1 ? new Date('2026-11-02T10:00:00.000Z') : null
			}))
		);
		const data = (await load({ locals: {} } as Parameters<typeof load>[0])) as {
			comments: { status: string; createdAt: string; editedAt: string | null }[];
		};
		expect(getUserComments).toHaveBeenCalledWith('user-1');
		expect(data.comments.map((c) => c.status)).toEqual([
			'pending',
			'published',
			'hidden',
			'rejected',
			'deleted'
		]);
		expect(data.comments[0].createdAt).toBe('2026-11-01T10:00:00.000Z');
		expect(data.comments[1].editedAt).toBe('2026-11-02T10:00:00.000Z');
		expect(data.comments[0].editedAt).toBeNull();
	});
});
