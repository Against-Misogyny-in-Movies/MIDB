import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { ageAccount, makeModerator, seedTitle } from './support/db.ts';
import { hasTmdb, NO_TMDB_REASON } from './support/env.ts';
import { signUpWithPasskey } from './support/passkeys.ts';

// The Worker has no ANTHROPIC_API_KEY and MODERATION_DEV_AUTO_APPROVE is off, so every comment
// that passes the blocklist is pending until a moderator approves it.

const TMDB_ID = 920001;
const TITLE = 'Comment spec fixture';

interface Reader {
	context: BrowserContext;
	page: Page;
	username: string;
}

/** A signed-in reader in a context of their own. */
async function reader(browser: Browser): Promise<Reader> {
	const context = await browser.newContext();
	const page = await context.newPage();
	const username = await signUpWithPasskey(page);
	return { context, page, username };
}

/** A moderator approves the pending comment with this text from the queue. */
async function approve(page: Page, text: string) {
	await page.goto('/user/moderation');
	const item = page.locator('li.item', { hasText: text });
	await expect(item).toBeVisible();
	await item.getByRole('button', { name: 'Approve' }).click();
	await expect(item).toHaveCount(0);
}

// The auth endpoints allow a few sign-ups a minute per address (`RL_AUTH`), so the three accounts
// are made once and every test in the file uses them.
test.describe.configure({ mode: 'serial' });

let author: Reader;
let other: Reader;
let moderator: Reader;

test.beforeAll(async ({ browser }) => {
	[author, other, moderator] = [
		await reader(browser),
		await reader(browser),
		await reader(browser)
	];
	makeModerator(moderator.username);
});

test.afterAll(async () => {
	// A failed `beforeAll` leaves some of them unset.
	for (const member of [author, other, moderator] as (Reader | undefined)[]) {
		await member?.context.close();
	}
});

test.describe('through the API, with no TMDB', () => {
	test('a pending comment is visible only to its author until a moderator approves it', async ({
		request
	}) => {
		seedTitle('movie', TMDB_ID, TITLE);
		const list = `/api/titles/movie/${TMDB_ID}/comments`;
		const text = `Pending until approved ${Date.now()}`;

		const posted = await author.page.request.post(list, { data: { body: text } });
		expect(posted.status()).toBe(201);
		const { comment } = (await posted.json()) as { comment: { id: string; status: string } };
		expect(comment.status).toBe('pending');

		// Not in the public list, and the author's own view has it.
		expect(JSON.stringify(await (await request.get(list)).json())).not.toContain(text);
		const own = await author.page.request.get(`${list}/viewer`);
		expect(JSON.stringify(await own.json())).toContain(text);

		// Another reader's view does not.
		const theirs = await other.page.request.get(`${list}/viewer`);
		expect(JSON.stringify(await theirs.json())).not.toContain(text);

		await approve(moderator.page, text);

		const published = (await (await request.get(list)).json()) as {
			comments: { id: string; body: string }[];
		};
		expect(published.comments.map((c) => c.body)).toContain(text);

		// Reply, edit, vote and report through the endpoints, as the other reader.
		const reply = await other.page.request.post(list, {
			data: { body: `Reply ${Date.now()}`, parentId: comment.id }
		});
		expect(reply.status()).toBe(201);
		// A fresh account's vote is refused until the account is old enough.
		const freshVote = await other.page.request.put(`/api/comments/${comment.id}/vote`, {
			data: { value: 1 }
		});
		expect(freshVote.status()).toBe(403);
		expect(await freshVote.json()).toMatchObject({
			message: 'Votes open once an account is 7 days old.'
		});
		ageAccount(other.username);
		const vote = await other.page.request.put(`/api/comments/${comment.id}/vote`, {
			data: { value: 1 }
		});
		expect(await vote.json()).toMatchObject({ score: 1, vote: 1 });
		const ownVote = await author.page.request.put(`/api/comments/${comment.id}/vote`, {
			data: { value: 1 }
		});
		expect(ownVote.status()).toBe(403);
		const report = await other.page.request.post(`/api/comments/${comment.id}/report`, {
			data: { reason: 'spam' }
		});
		expect(report.ok()).toBe(true);
		const edit = await author.page.request.patch(`/api/comments/${comment.id}`, {
			data: { body: `${text} (edited)` }
		});
		expect(edit.ok()).toBe(true);
		const foreignEdit = await other.page.request.patch(`/api/comments/${comment.id}`, {
			data: { body: 'not mine' }
		});
		// Another account's comment is not found, whatever its status.
		expect(foreignEdit.status()).toBe(404);
	});

	test('writes need a signed-in reader', async ({ request }) => {
		const response = await request.post('/api/titles/movie/920001/comments', {
			data: { body: 'anonymous' }
		});
		expect(response.status()).toBe(401);
		expect(response.headers()['cache-control']).toBe('private, no-store');
	});
});

test.describe('on a film page', () => {
	test.skip(!hasTmdb, NO_TMDB_REASON);

	test('comment, vote, reply, report and edit, with a moderator approving', async ({ browser }) => {
		const stamp = Date.now();
		const text = `First comment ${stamp}`;
		const replyText = `Reply to it ${stamp}`;
		const editedText = `First comment, edited ${stamp}`;
		const page = '/movie/603';

		// The author writes a comment: it is pending and shows a badge and a note to them alone.
		await author.page.goto(page);
		await author.page.getByRole('textbox', { name: 'Write a comment' }).fill(text);
		await author.page.getByRole('button', { name: 'Comment', exact: true }).click();
		const own = author.page.locator('article.comment', { hasText: text });
		await expect(own).toContainText('Awaiting review');
		await expect(own).toContainText('Only the author and moderators see the comment');

		// A signed-out reader sees no comment.
		const anonymous = await browser.newPage();
		await anonymous.goto(page);
		await expect(anonymous.getByRole('heading', { name: 'Comments' })).toBeVisible();
		await expect(anonymous.getByText(text)).toHaveCount(0);
		await anonymous.close();

		await approve(moderator.page, text);

		ageAccount(other.username);

		// A second reader sees it, votes on it and replies. Their reply is pending too.
		await other.page.goto(page);
		const comment = other.page.locator('article.comment', { hasText: text });
		await expect(comment).toBeVisible();
		await comment.getByRole('button', { name: 'Upvote' }).click();
		await expect(comment.getByRole('button', { name: 'Upvote' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(comment.locator('.score')).toContainText('1');
		await comment.getByRole('button', { name: 'Reply', exact: true }).click();
		await other.page.getByRole('textbox', { name: /^Reply to / }).fill(replyText);
		await other.page.getByRole('button', { name: 'Reply', exact: true }).last().click();
		await expect(other.page.locator('article.comment', { hasText: replyText })).toContainText(
			'Awaiting review'
		);

		// The second community reports the author's comment.
		await comment.getByRole('button', { name: 'Report', exact: true }).click();
		await other.page.getByLabel('Spam').check();
		await other.page.getByRole('button', { name: 'Send report' }).click();
		await expect(other.page.getByText('Report sent. Moderators review it.')).toBeVisible();

		// The author edits their comment. An edit is moderated again, so it is pending.
		await own.getByRole('button', { name: 'Edit', exact: true }).click();
		const editor = author.page.getByRole('textbox', { name: 'Edit comment' });
		await editor.fill(editedText);
		await author.page.getByRole('button', { name: 'Save' }).click();
		await expect(author.page.locator('article.comment', { hasText: editedText })).toBeVisible();
	});
});
