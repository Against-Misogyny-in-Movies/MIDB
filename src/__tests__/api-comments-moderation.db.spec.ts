import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { users } from '#db/schema/auth.ts';
import { titles } from '#db/schema/titles.ts';
import { comments } from '#db/schema/community.ts';
import { userValues } from '#db/test/users.ts';
import { env, purgeCalls, resetCloudflareStub } from '#test/cloudflare-workers.stub.ts';
import type { UserRow } from '#lib/server/data/user-queries.ts';
import type { TitleRow } from '#lib/server/data/title-queries.ts';

const create = vi.fn();
vi.mock('#lib/server/integrations/anthropic.ts', () => ({
	getAnthropic: () => (env.ANTHROPIC_API_KEY ? { messages: { create } } : null)
}));

const resolveCommentTitle = vi.fn();
vi.mock('#lib/server/data/comment-title.ts', () => ({
	resolveCommentTitle,
	findCommentTitle: resolveCommentTitle,
	parseTitleParams: (kind: string, tmdbId: string) => ({ kind, tmdbId })
}));

const { POST } = await import('../routes/api/titles/[kind]/[tmdbId]/comments/+server');
const { PATCH } = await import('../routes/api/comments/[id]/+server');
const { listTitleComments, getViewerCommentState } =
	await import('#lib/server/data/comment-queries.ts');
const { listPendingQueue } = await import('#lib/server/data/moderation-queue.ts');
const { clearCache } = await import('#lib/server/cache/index.ts');

type Handler = (e: never) => Promise<Response> | Response;
const handler: Handler = POST;
const patchHandler: Handler = PATCH;

let title: TitleRow;
let author: UserRow;

const reply = (verdict: object) => ({
	stop_reason: 'end_turn',
	content: [
		{ type: 'text', text: JSON.stringify({ categories: [], reason: 'Reason.', ...verdict }) }
	]
});

async function post(body: string) {
	const event = {
		params: { kind: 'movie', tmdbId: '348' },
		url: new URL('http://localhost/api/x'),
		request: new Request('http://localhost/api/x', {
			method: 'POST',
			body: JSON.stringify({ body }),
			headers: { 'content-type': 'application/json' }
		}),
		locals: { getUser: async () => author },
		getClientAddress: () => '203.0.113.9'
	} as unknown as RequestEvent;
	const response = await handler(event as never);
	const json: { comment: { id: string; status: string } } = await response.json();
	return json;
}

beforeEach(async () => {
	resetCloudflareStub();
	await clearCache();
	create.mockReset();
	env.ANTHROPIC_API_KEY = 'sk-test';
	await db.insert(users).values(userValues('author'));
	[author] = await db.select().from(users).where(eq(users.id, 'author'));
	[title] = await db
		.insert(titles)
		.values({ kind: 'movie', title: 'Alien', cleanTitle: 'alien', tmdbId: 348 })
		.returning();
	resolveCommentTitle.mockResolvedValue(title);
});

describe('comment moderation through the endpoint', () => {
	it('publishes an allowed comment, lists it and purges the title tag', async () => {
		create.mockResolvedValueOnce(reply({ decision: 'allow', severity: 0 }));
		const { comment } = await post('The film frames the scene as a warning.');
		expect(comment.status).toBe('published');
		expect(purgeCalls).toEqual([{ tags: ['comments:movie:348'] }]);
		const list = await listTitleComments(title.id, { sort: 'new' });
		expect(list.comments.map((c) => c.id)).toEqual([comment.id]);
		const [stored] = await db.select().from(comments).where(eq(comments.id, comment.id));
		expect(stored.moderationSource).toBe('ai');
		expect(JSON.parse(stored.aiVerdict ?? '')).toMatchObject({
			decision: 'allow',
			model: 'claude-haiku-5-5'
		});
	});

	it('rejects a severe comment: not listed, shown to its author with the reason', async () => {
		create.mockResolvedValueOnce(
			reply({
				decision: 'reject',
				severity: 3,
				categories: ['harassment'],
				reason: 'Attacks a person.'
			})
		);
		const { comment } = await post('An attack on another reader.');
		expect(comment.status).toBe('rejected');
		expect((await listTitleComments(title.id, { sort: 'new' })).comments).toEqual([]);
		const state = await getViewerCommentState(title.id, author);
		expect(state.comments).toMatchObject([
			{ id: comment.id, status: 'rejected', moderationReason: 'Attacks a person.' }
		]);
		const other = await getViewerCommentState(title.id, { id: 'someone', mutedUntil: null });
		expect(other.comments).toEqual([]);
	});

	it('rejects a blocklisted comment without calling the model', async () => {
		env.MODERATION_EXTRA_TERMS = 'zorblax';
		const { comment } = await post('You zorblax.');
		expect(comment.status).toBe('rejected');
		expect(create).not.toHaveBeenCalled();
		const [stored] = await db.select().from(comments).where(eq(comments.id, comment.id));
		expect(stored.moderationSource).toBe('blocklist');
	});

	it('queues a review verdict and a failed check for a moderator', async () => {
		create.mockResolvedValueOnce(reply({ decision: 'review', severity: 1 }));
		create.mockRejectedValueOnce(new Error('network'));
		const first = await post('Unclear comment.');
		const second = await post('Another comment.');
		expect([first.comment.status, second.comment.status]).toEqual(['pending', 'pending']);
		expect((await listTitleComments(title.id, { sort: 'new' })).comments).toEqual([]);
		const queue = await listPendingQueue();
		expect(queue.map((i) => i.comment.id).sort()).toEqual(
			[first.comment.id, second.comment.id].sort()
		);
	});

	it('queues every comment when there is no key', async () => {
		delete env.ANTHROPIC_API_KEY;
		const { comment } = await post('A comment.');
		expect(comment.status).toBe('pending');
		expect(create).not.toHaveBeenCalled();
	});
});

describe('comment edits through the endpoint', () => {
	async function seed(over: Partial<typeof comments.$inferInsert> & { id: string }) {
		await db
			.insert(comments)
			.values({ titleId: title.id, userId: 'author', body: 'Text', ...over });
	}
	async function patch(id: string, body: string) {
		const event = {
			params: { id },
			url: new URL('http://localhost/api/x'),
			request: new Request('http://localhost/api/x', {
				method: 'PATCH',
				body: JSON.stringify({ body }),
				headers: { 'content-type': 'application/json' }
			}),
			locals: { getUser: async () => author },
			getClientAddress: () => '203.0.113.9'
		} as unknown as RequestEvent;
		const response = await patchHandler(event as never);
		const json: { comment: { status: string } } = await response.json();
		return json.comment;
	}
	const row = async (id: string) =>
		(await db.select().from(comments).where(eq(comments.id, id)))[0];

	it('publishes a pending reply when the check allows the edit, and counts it', async () => {
		await seed({ id: 'root', status: 'published', body: 'Root' });
		await seed({ id: 'r1', status: 'pending', parentId: 'root', rootId: 'root', body: 'Reply' });
		create.mockResolvedValueOnce(reply({ decision: 'allow', severity: 0 }));
		const comment = await patch('r1', 'A clearer reply.');
		expect(comment.status).toBe('published');
		expect((await row('root')).replyCount).toBe(1);
		expect(await row('r1')).toMatchObject({ status: 'published', moderationSource: 'ai' });
		expect(purgeCalls).toEqual([{ tags: ['comments:movie:348'] }]);
	});

	it('rejects an edit that hits the blocklist without calling the model', async () => {
		await seed({ id: 'c1', status: 'published', body: 'Fine' });
		env.MODERATION_EXTRA_TERMS = 'zorblax';
		const comment = await patch('c1', 'You zorblax.');
		expect(comment.status).toBe('rejected');
		expect(create).not.toHaveBeenCalled();
		expect(await row('c1')).toMatchObject({ status: 'rejected', moderationSource: 'blocklist' });
		expect((await listTitleComments(title.id, { sort: 'new' })).comments).toEqual([]);
	});

	it.each(['hidden', 'deleted', 'published'] as const)(
		'sends the parent text to the model only when the parent is published (%s)',
		async (status) => {
			await seed({ id: 'root', status, body: 'Parent text' });
			await seed({ id: 'r1', status: 'pending', parentId: 'root', rootId: 'root', body: 'Reply' });
			create.mockResolvedValueOnce(reply({ decision: 'review', severity: 1 }));
			await patch('r1', 'An edited reply.');
			const content = create.mock.calls[0][0].messages[0].content as string;
			expect(content.includes('Parent text')).toBe(status === 'published');
			expect(content).toContain('<comment>An edited reply.</comment>');
		}
	);
});
