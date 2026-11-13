import type {
	CommentList,
	CommentSort,
	CommentView,
	OwnComment,
	ReportReason,
	ViewerCommentState
} from '#lib/media/types/comments.ts';
import { commentResult } from '#lib/media/utils/comments.ts';
import {
	type CommentAction,
	describeFailure,
	requestJson,
	type Fetcher,
	type Reply
} from '#lib/media/utils/commentApi.ts';
import { toasts } from '#lib/media/utils/toasts.svelte.js';

/**
 * One title's comment section: the public list (edge-cached, the same for every reader), the
 * signed-in reader's votes and unpublished comments (`private, no-store`), and the writes. A
 * write patches this state from its own response rather than refetching the list, because the
 * list is edge-cached and a purge lands a moment after the write. A write's outcome is a toast
 * (`toasts.svelte.ts`), worded here. A failure the page shows in place is stored under its key instead: a
 * list that did not load (`load`, `viewer`), and text the server refused (a 400 on `compose`,
 * `reply:<id>` or `edit:<id>`), which the composer shows under its field.
 */
const SHOWN_STATUSES = new Set<OwnComment['status']>(['pending', 'rejected', 'published']);

export class CommentsState {
	readonly kind: 'movie' | 'tv';
	readonly tmdbId: string;

	sort = $state<CommentSort>('top');
	list = $state<CommentView[]>([]);
	nextCursor = $state<string | null>(null);
	/** `loading` until the first page of the current sort arrives. */
	phase = $state<'loading' | 'ready' | 'error'>('loading');
	viewer = $state<ViewerCommentState | null>(null);
	/** `idle` until a signed-in reader's state is requested; `ready` also after a 401 (nothing to show). */
	viewerPhase = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	errors = $state<Record<string, string>>({});
	busy = $state<Record<string, boolean>>({});

	#fetch: Fetcher;
	/** Bumped by each list load, so a slow answer for an older sort cannot overwrite a newer one. */
	#generation = 0;

	constructor(kind: 'movie' | 'tv', tmdbId: string, fetcher?: Fetcher) {
		this.kind = kind;
		this.tmdbId = tmdbId;
		this.#fetch = fetcher ?? ((input, init) => fetch(input, init));
	}

	get #base(): string {
		return `/api/titles/${this.kind}/${this.tmdbId}/comments`;
	}

	#request<T>(method: string, url: string, body?: unknown): Promise<Reply<T>> {
		return requestJson<T>(this.#fetch, method, url, body);
	}

	#fail(key: string, action: CommentAction, reply: { status: number; message: string }): void {
		const message = describeFailure(action, reply.status, reply.message);
		const inPlace =
			action === 'load' ||
			action === 'viewer' ||
			((action === 'create' || action === 'edit') && reply.status === 400);
		if (!inPlace) {
			toasts.error(message);
			return;
		}
		this.errors[key] = message;
	}

	#start(key: string): void {
		this.busy[key] = true;
		delete this.errors[key];
	}

	/** The first page of the current sort. */
	async load(): Promise<void> {
		const generation = ++this.#generation;
		this.phase = 'loading';
		delete this.errors.load;
		const reply = await this.#request<CommentList>('GET', `${this.#base}?sort=${this.sort}`);
		if (generation !== this.#generation) return;
		if (!reply.ok) {
			this.#fail('load', 'load', reply);
			this.phase = 'error';
			return;
		}
		this.list = reply.data.comments;
		this.nextCursor = reply.data.nextCursor;
		this.phase = 'ready';
	}

	setSort(sort: CommentSort): Promise<void> {
		if (sort === this.sort) return Promise.resolve();
		this.sort = sort;
		return this.load();
	}

	async loadMore(): Promise<void> {
		if (!this.nextCursor || this.busy.more) return;
		const generation = this.#generation;
		this.#start('more');
		const url = `${this.#base}?sort=${this.sort}&cursor=${encodeURIComponent(this.nextCursor)}`;
		const reply = await this.#request<CommentList>('GET', url);
		this.busy.more = false;
		if (generation !== this.#generation) return;
		if (!reply.ok) return this.#fail('more', 'more', reply);
		const known = this.list.map((c) => c.id);
		this.list = [...this.list, ...reply.data.comments.filter((c) => !known.includes(c.id))];
		this.nextCursor = reply.data.nextCursor;
	}

	/** The signed-in reader's votes and own unpublished comments. */
	async loadViewer(): Promise<void> {
		if (this.viewerPhase === 'loading') return;
		this.viewerPhase = 'loading';
		delete this.errors.viewer;
		const reply = await this.#request<ViewerCommentState>('GET', `${this.#base}/viewer`);
		if (reply.ok) {
			this.viewer = reply.data;
			this.viewerPhase = 'ready';
		} else if (reply.status === 401) {
			// Signed out after all (the first paint only guessed): there is nothing to merge.
			this.viewer = null;
			this.viewerPhase = 'ready';
		} else {
			this.#fail('viewer', 'viewer', reply);
			this.viewerPhase = 'error';
		}
	}

	clearViewer(): void {
		this.viewer = null;
		this.viewerPhase = 'idle';
		delete this.errors.viewer;
	}

	#ensureViewer(): ViewerCommentState {
		this.viewer ??= { votes: {}, comments: [], mutedUntil: null };
		return this.viewer;
	}

	/** A comment, or a reply, in the public list. */
	#find(id: string): CommentView | null {
		for (const root of this.list) {
			if (root.id === id) return root;
			const reply = root.replies.find((r) => r.id === id);
			if (reply) return reply;
		}
		return null;
	}

	/**
	 * Keeps the reader's own comment in the viewer state while it is not public (pending,
	 * rejected) or is published but not in the cached list yet, so `buildThreads` shows it at
	 * once under any sort. Once the list carries it, the public view wins.
	 */
	#setOwn(comment: OwnComment): void {
		const viewer = this.#ensureViewer();
		const rest = viewer.comments.filter((c) => c.id !== comment.id);
		const shownPublicly = comment.status === 'published' && this.#find(comment.id) !== null;
		viewer.comments =
			shownPublicly || !SHOWN_STATUSES.has(comment.status) ? rest : [comment, ...rest];
	}

	/** Takes a comment out of the public list: a placeholder while it has replies, else gone. */
	#withdraw(id: string): void {
		const target = this.#find(id);
		if (!target) return;
		if (target.replyCount > 0) {
			target.removed = true;
			target.body = null;
			target.author = null;
			target.score = 0;
			target.editedAt = null;
			return;
		}
		if (target.parentId === null) {
			this.list = this.list.filter((c) => c.id !== id);
			return;
		}
		for (const root of this.list) {
			if (root.replies.some((r) => r.id === id)) {
				root.replies = root.replies.filter((r) => r.id !== id);
				root.replyCount = Math.max(root.replyCount - 1, 0);
			}
		}
	}

	/** Stores a comment or, with `parentId`, a reply. True when the server stored it. */
	async post(body: string, parentId: string | null = null): Promise<boolean> {
		const key = parentId ? `reply:${parentId}` : 'compose';
		this.#start(key);
		const reply = await this.#request<{ comment: OwnComment }>('POST', this.#base, {
			body,
			...(parentId ? { parentId } : {})
		});
		this.busy[key] = false;
		if (!reply.ok) {
			this.#fail(key, 'create', reply);
			return false;
		}
		// A published comment is not in the cached list yet (the purge that follows this write
		// refreshes it), so the viewer state carries it until the list does.
		const { comment } = reply.data;
		this.#setOwn(comment);
		const result = commentResult('post', comment);
		toasts.show(result.tone, result.text);
		return true;
	}

	/** Saves an edit. The comment goes through moderation again, so it may leave the public list. */
	async edit(id: string, body: string): Promise<boolean> {
		const key = `edit:${id}`;
		this.#start(key);
		const reply = await this.#request<{ comment: OwnComment }>('PATCH', `/api/comments/${id}`, {
			body
		});
		this.busy[key] = false;
		if (!reply.ok) {
			this.#fail(key, 'edit', reply);
			return false;
		}
		const { comment } = reply.data;
		const shown = this.#find(id);
		if (comment.status === 'published' && shown) {
			shown.body = comment.body;
			shown.editedAt = comment.editedAt;
		} else if (comment.status !== 'published') {
			this.#withdraw(id);
		}
		this.#setOwn(comment);
		const result = commentResult('edit', comment);
		toasts.show(result.tone, result.text);
		return true;
	}

	async remove(id: string): Promise<boolean> {
		const key = `delete:${id}`;
		this.#start(key);
		const reply = await this.#request<{ ok: true }>('DELETE', `/api/comments/${id}`);
		this.busy[key] = false;
		if (!reply.ok) {
			this.#fail(key, 'delete', reply);
			return false;
		}
		this.#withdraw(id);
		const viewer = this.viewer;
		if (viewer) viewer.comments = viewer.comments.filter((c) => c.id !== id);
		toasts.success('Comment deleted.');
		return true;
	}

	/** Sets the reader's vote, or removes it when `value` is the vote they already have. */
	async vote(id: string, value: 1 | -1): Promise<void> {
		const key = `vote:${id}`;
		if (this.busy[key]) return;
		this.#start(key);
		const current = this.viewer?.votes[id];
		const reply =
			current === value
				? await this.#request<{ score: number; vote: 1 | -1 | null }>(
						'DELETE',
						`/api/comments/${id}/vote`
					)
				: await this.#request<{ score: number; vote: 1 | -1 | null }>(
						'PUT',
						`/api/comments/${id}/vote`,
						{ value }
					);
		this.busy[key] = false;
		if (!reply.ok) return this.#fail(key, 'vote', reply);
		const viewer = this.#ensureViewer();
		if (reply.data.vote === null) delete viewer.votes[id];
		else viewer.votes[id] = reply.data.vote;
		const shown = this.#find(id);
		if (shown) shown.score = reply.data.score;
	}

	/** Reports a comment. True when the server took the report, or this account had reported it before. */
	async report(id: string, input: { reason: ReportReason; note: string }): Promise<boolean> {
		const key = `report:${id}`;
		this.#start(key);
		const note = input.note.trim();
		const reply = await this.#request<{ alreadyReported: boolean }>(
			'POST',
			`/api/comments/${id}/report`,
			{ reason: input.reason, ...(note ? { note } : {}) }
		);
		this.busy[key] = false;
		if (!reply.ok) {
			this.#fail(key, 'report', reply);
			return false;
		}
		toasts.success(
			reply.data.alreadyReported
				? 'This account already reported the comment.'
				: 'Report sent. Moderators review it.'
		);
		return true;
	}

	/** When the reader's mute ends, while it has not; otherwise null. */
	get mutedUntil(): string | null {
		const until = this.viewer?.mutedUntil ?? null;
		return until && Date.parse(until) > Date.now() ? until : null;
	}

	/** The reader's vote on a comment: 1, -1 or null. */
	voteOf(id: string): 1 | -1 | null {
		return this.viewer?.votes[id] ?? null;
	}
}
