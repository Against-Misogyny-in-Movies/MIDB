import type {
	CommentList,
	CommentSort,
	CommentThread,
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

type VoteReply = { score: number; vote: 1 | -1 | null };

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
	/** The thread a link points at, pinned above the list when its comment is not on the loaded pages. */
	linked = $state<({ id: string } & CommentThread) | null>(null);
	/** Whether the failed link can be tried again: false for a comment that is not available. */
	linkRetryable = $state(false);
	/** The comment the section just scrolled to, drawn highlighted until the reader acts or the link changes. */
	highlightId = $state<string | null>(null);
	/** The score after the reader's own last vote press, for a screen reader's status line. Server answers never set it. */
	announcement = $state('');

	#fetch: Fetcher;
	/** Per comment, while a vote is unsettled: what the server confirmed, the vote the reader wants, and whether a request is out. */
	#votes: Record<string, { confirmed: VoteReply; intended: 1 | -1 | null; sending?: boolean }> = {};
	/** Bumped by each list load, so a slow answer for an older sort cannot overwrite a newer one. */
	#generation = 0;
	/** The first-page load in flight or last settled, so a link waits to see whether the list has its comment. */
	#loading: Promise<void> = Promise.resolve();
	/** Bumped by each link request, so a slow answer for an older link cannot replace a newer one. */
	#linkGeneration = 0;
	/** Bumped when the viewer is cleared, so a vote reply that lands after signing out is dropped. */
	#viewerGeneration = 0;

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

	#fail(
		key: string,
		action: CommentAction,
		reply: { status: number; message: string },
		author?: string
	): void {
		const message = describeFailure(action, reply.status, reply.message, author);
		const inPlace =
			action === 'load' ||
			action === 'viewer' ||
			((action === 'create' || action === 'edit') && reply.status === 400);
		if (!inPlace) {
			toasts.error(message);
			// A mute or ban the page did not know of: the viewer state carries it, so reload it and the controls lock.
			if (reply.status === 403 && /muted|banned/i.test(reply.message)) void this.loadViewer();
			return;
		}
		this.errors[key] = message;
	}

	#start(key: string): void {
		this.busy[key] = true;
		delete this.errors[key];
	}

	/** The first page of the current sort. */
	load(): Promise<void> {
		return (this.#loading = this.#loadFirstPage());
	}

	async #loadFirstPage(): Promise<void> {
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
		this.#applyScores(this.list);
		if (this.linked) this.#applyScores([this.linked.root]);
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
		const added = reply.data.comments.filter((c) => !known.includes(c.id));
		this.#applyScores(added);
		this.list = [...this.list, ...added];
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
			this.#applyScores(this.#roots());
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
		this.#viewerGeneration++;
		this.viewer = null;
		this.viewerPhase = 'idle';
		delete this.errors.viewer;
	}

	#ensureViewer(): ViewerCommentState {
		this.viewer ??= { votes: {}, scores: {}, comments: [], mutedUntil: null };
		return this.viewer;
	}

	/**
	 * Shows the current score of each comment the reader voted on over the cached list's, which
	 * trails votes by the edge TTL. A comment with a vote request out keeps its optimistic score.
	 */
	#applyScores(comments: CommentView[]): void {
		const scores = this.viewer?.scores;
		if (!scores) return;
		for (const root of comments) {
			for (const comment of [root, ...root.replies]) {
				const score = scores[comment.id];
				if (score !== undefined && !this.#votes[comment.id]) comment.score = score;
			}
		}
	}

	/** The roots on screen: the pinned thread's, then the list's. */
	#roots(): CommentView[] {
		return this.linked ? [this.linked.root, ...this.list] : this.list;
	}

	/** A comment, or a reply, in the pinned thread or the public list. */
	#find(id: string, roots: readonly CommentView[] = this.#roots()): CommentView | null {
		return this.#findAll(id, roots)[0] ?? null;
	}

	/**
	 * Every copy of a comment: a page that brings the pinned thread's root again holds a second
	 * object for it, and a write patches them all so whichever is drawn next shows the change.
	 */
	#findAll(id: string, roots: readonly CommentView[] = this.#roots()): CommentView[] {
		const found: CommentView[] = [];
		for (const root of roots) {
			if (root.id === id) found.push(root);
			const reply = root.replies.find((r) => r.id === id);
			if (reply) found.push(reply);
		}
		return found;
	}

	/**
	 * Makes the comment a link points at ready to show. A comment on the loaded pages needs
	 * nothing, unless the list holds it as a placeholder: then its thread is fetched, because its
	 * author and staff may read it. Any other comment's thread is fetched and pinned above the
	 * list, which then leaves that thread out wherever a later page carries it. A thread on
	 * another title counts as not available. False when the comment is not available to this
	 * reader (`errors.link` says why) and any earlier pin is dropped.
	 */
	async showLink(id: string): Promise<boolean> {
		const generation = ++this.#linkGeneration;
		delete this.errors.link;
		await this.#loading;
		if (generation !== this.#linkGeneration) return false;
		const listed = this.#find(id, this.list);
		if (listed && !listed.removed) {
			this.linked = null;
			this.busy.link = false;
			return true;
		}
		if (this.linked && this.#find(id, [this.linked.root])) {
			this.busy.link = false;
			return true;
		}
		this.busy.link = true;
		const reply = await this.#request<CommentThread>('GET', `/api/comments/${id}`);
		if (generation !== this.#linkGeneration) return false;
		this.busy.link = false;
		if (reply.ok && reply.data.kind === this.kind && String(reply.data.tmdbId) === this.tmdbId) {
			this.linked = { id, ...reply.data };
			this.#applyScores([reply.data.root]);
			return true;
		}
		this.linked = null;
		// A thread on another title is as unavailable here as a 404.
		if (reply.ok || reply.status === 404) {
			// Only the author and staff may read it: the placeholder the list shows is all there is.
			if (listed) return true;
			this.linkRetryable = false;
			this.errors.link = 'This comment is not available.';
		} else {
			this.linkRetryable = true;
			this.errors.link = describeFailure('link', reply.status, reply.message);
		}
		return false;
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
		const targets = this.#findAll(id);
		const [target] = targets;
		if (!target) return;
		if (target.replyCount > 0) {
			for (const copy of targets) {
				copy.removed = true;
				copy.body = null;
				copy.author = null;
				copy.score = 0;
				copy.editedAt = null;
			}
			return;
		}
		if (target.parentId === null) {
			this.list = this.list.filter((c) => c.id !== id);
			if (this.linked?.root.id === id) this.linked = null;
			return;
		}
		for (const root of this.#roots()) {
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
		const shown = this.#findAll(id);
		if (comment.status === 'published' && shown.length > 0) {
			for (const copy of shown) {
				copy.body = comment.body;
				copy.editedAt = comment.editedAt;
			}
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

	/**
	 * Sets the reader's vote, or removes it when `value` is the vote they already have. The vote and
	 * the score show at once. Clicks while a request is out only change the intended vote; when the
	 * request returns, one more goes only if the intended vote differs from what the server holds.
	 */
	async vote(id: string, value: 1 | -1): Promise<void> {
		// Before the reader's own votes are known, a press would read "no vote" and get the toggle and the score wrong.
		if (this.viewerPhase === 'loading' || this.viewerPhase === 'error') return;
		const viewerGeneration = this.#viewerGeneration;
		const viewer = this.#ensureViewer();
		const current = viewer.votes[id] ?? null;
		const sync = this.#votes[id] ?? {
			confirmed: { vote: current, score: viewer.scores[id] ?? this.#find(id)?.score ?? 0 },
			intended: current
		};
		this.#votes[id] = sync;
		sync.intended = current === value ? null : value;
		this.#showVote(id, sync.intended, sync.confirmed);
		this.announcement = `Score ${this.#find(id)?.score ?? sync.confirmed.score}`;
		if (sync.sending) return;
		sync.sending = true;
		while (sync.intended !== sync.confirmed.vote) {
			const sent = sync.intended;
			const reply =
				sent === null
					? await this.#request<VoteReply>('DELETE', `/api/comments/${id}/vote`)
					: await this.#request<VoteReply>('PUT', `/api/comments/${id}/vote`, { value: sent });
			if (viewerGeneration !== this.#viewerGeneration) break;
			if (!reply.ok) {
				sync.intended = sync.confirmed.vote;
				this.#showVote(id, sync.intended, sync.confirmed);
				this.#fail(`vote:${id}`, 'vote', reply, this.#find(id)?.author?.displayName);
				break;
			}
			sync.confirmed = reply.data;
			this.#showVote(id, sync.intended, sync.confirmed);
		}
		if (this.#votes[id] === sync) delete this.#votes[id];
	}

	/** Shows `vote` as the reader's, with the score the server last confirmed moved by the difference. */
	#showVote(id: string, vote: 1 | -1 | null, confirmed: VoteReply): void {
		const viewer = this.#ensureViewer();
		if (vote === null) delete viewer.votes[id];
		else viewer.votes[id] = vote;
		viewer.scores[id] = confirmed.score;
		for (const copy of this.#findAll(id)) {
			copy.score = confirmed.score + (vote ?? 0) - (confirmed.vote ?? 0);
		}
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
