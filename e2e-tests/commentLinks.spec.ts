import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { removeSeededComments, seedComments, seedTitle } from './support/db.ts';
import { hasTmdb, NO_TMDB_REASON } from './support/env.ts';
import { signUpWithPasskey } from './support/passkeys.ts';

// Twenty-five comments by one account, scored so that the last one is on the second page of the
// default "Top" sort (a page is 20 roots). The Worker has no moderation key, so the pending
// comment stays pending.

const TMDB_ID = 604;
const TITLE = 'Comment link fixture';
const PREFIX = 'e2e-link-';
const COUNT = 25;
const SECOND_PAGE = `${PREFIX}${COUNT - 1}`;
const PENDING = `${PREFIX}pending`;

interface Reader {
	context: BrowserContext;
	page: Page;
	username: string;
}

async function reader(browser: Browser): Promise<Reader> {
	const context = await browser.newContext();
	const page = await context.newPage();
	return { context, page, username: await signUpWithPasskey(page) };
}

test.describe.configure({ mode: 'serial' });

let author: Reader;

test.beforeAll(async ({ browser }) => {
	author = await reader(browser);
	seedTitle('movie', TMDB_ID, TITLE);
	seedComments('movie', TMDB_ID, author.username, [
		...Array.from({ length: COUNT }, (_, i) => ({
			id: `${PREFIX}${i}`,
			body: `Linked comment number ${i}`,
			score: 100 - i
		})),
		{ id: PENDING, body: 'Not yet public', status: 'pending' as const }
	]);
});

test.afterAll(async () => {
	removeSeededComments(PREFIX);
	await author?.context.close();
});

test.describe('GET /api/comments/[id], with no TMDB', () => {
	test('gives anyone a published comment, never cached', async ({ request }) => {
		const response = await request.get(`/api/comments/${SECOND_PAGE}`);
		expect(response.status()).toBe(200);
		expect(response.headers()['cache-control']).toBe('private, no-store');
		const thread = (await response.json()) as { root: { id: string; body: string }; review: null };
		expect(thread.root).toMatchObject({
			id: SECOND_PAGE,
			body: `Linked comment number ${COUNT - 1}`
		});
		expect(thread.review).toBeNull();
	});

	test('gives a pending comment to its author only', async ({ request }) => {
		expect((await request.get(`/api/comments/${PENDING}`)).status()).toBe(404);
		const own = await author.page.request.get(`/api/comments/${PENDING}`);
		expect(own.status()).toBe(200);
		expect(await own.json()).toMatchObject({
			root: { id: PENDING, body: 'Not yet public' },
			review: { status: 'pending' }
		});
	});

	test('answers 404 for a comment that does not exist', async ({ request }) => {
		const response = await request.get('/api/comments/no-such-comment');
		expect(response.status()).toBe(404);
		expect(response.headers()['cache-control']).toBe('private, no-store');
	});
});

test.describe('a link to a comment on a film page', () => {
	test.skip(!hasTmdb, NO_TMDB_REASON);

	test('opens a comment on the second page, pinned once, and keeps it single after "Show more"', async ({
		page
	}) => {
		await page.goto(`/movie/${TMDB_ID}#comment-${SECOND_PAGE}`);
		const pinned = page.getByRole('region', { name: 'Linked comment' });
		const article = pinned.locator(`#comment-${SECOND_PAGE}`);
		await expect(article).toContainText(`Linked comment number ${COUNT - 1}`);
		await expect(article).toBeFocused();
		await expect(article).toBeInViewport();
		await expect(page.locator('details#comments')).toHaveJSProperty('open', true);

		await page.getByRole('button', { name: 'Show more comments' }).click();
		await expect(page.getByRole('button', { name: 'Show more comments' })).toHaveCount(0);
		await expect(page.locator(`#comment-${SECOND_PAGE}`)).toHaveCount(1);
		await expect(page.locator('#comment-e2e-link-0')).toHaveCount(1);
	});

	test('opens a comment on the first page without pinning it', async ({ page }) => {
		await page.goto(`/movie/${TMDB_ID}#comment-${PREFIX}0`);
		await expect(page.locator(`#comment-${PREFIX}0`)).toBeFocused();
		await expect(page.getByRole('region', { name: 'Linked comment' })).toHaveCount(0);
	});

	test('shows a pending comment to its author with its status', async () => {
		await author.page.goto(`/movie/${TMDB_ID}#comment-${PENDING}`);
		await expect(author.page.locator(`#comment-${PENDING}`)).toContainText('Awaiting review');
	});

	test('says a comment is not available when it is not public', async ({ page }) => {
		await page.goto(`/movie/${TMDB_ID}#comment-${PENDING}`);
		await expect(page.getByText('This comment is not available.')).toBeVisible();
	});
});
