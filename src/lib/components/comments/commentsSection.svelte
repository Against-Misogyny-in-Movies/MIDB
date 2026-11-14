<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import CollapsibleSection from '#lib/components/movies/sections/collapsibleSection.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import CommentComposer from './commentComposer.svelte';
	import CommentList from './commentList.svelte';
	import type { CommentSort, OwnComment } from '#lib/media/types/comments.ts';
	import { buildThreads, withReview } from '#lib/media/utils/commentThread.ts';
	import { CommentsState } from '#lib/media/utils/commentsState.svelte.js';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { session } from '#lib/media/utils/session.svelte.js';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { titleHref } from '#lib/media/utils/titleHref.ts';

	interface Props {
		kind: 'movie' | 'tv';
		tmdbId: string;
		/** Tests give the section a fetcher; the pages use the browser's. */
		fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
	}

	let { kind, tmdbId, fetcher }: Props = $props();

	// One section per title: the pages key it on the TMDB id, so these never change.
	// svelte-ignore state_referenced_locally
	const comments = new CommentsState(kind, tmdbId, fetcher);

	const SORTS: { value: CommentSort; label: string }[] = [
		{ value: 'top', label: 'Top' },
		{ value: 'new', label: 'Newest' }
	];

	/** A `#comment-<id>` hash names the comment a link points at. */
	const LINK_HASH = /^#comment-([\w-]{1,64})$/;
	/** The linked comment waiting for the list to draw before the page scrolls to it. */
	let pendingReveal = $state<string | null>(null);
	/** A failed link waiting for the notice to draw before the page scrolls to it. */
	let pendingNotice = $state(false);
	/** The list has drawn once: a later link keeps it on screen and loads into the pin's slot. */
	let drawn = $state(false);

	/** The highlight stays until the reader acts on the page. */
	function clearHighlight(): void {
		comments.highlightId = null;
		document.removeEventListener('pointerdown', clearHighlight);
		document.removeEventListener('keydown', clearHighlight);
	}

	/** Makes the linked comment available (the section opens itself for the hash), then asks for the scroll. */
	async function followLink(): Promise<void> {
		clearHighlight();
		const id = LINK_HASH.exec(location.hash)?.[1];
		if (!id) return;
		pendingReveal = null;
		pendingNotice = false;
		if (await comments.showLink(id)) pendingReveal = id;
		else if (comments.errors.link) pendingNotice = true;
	}

	/**
	 * Scrolls to the comment, so the pinned block's label clears the sticky header, focuses it
	 * and highlights it until the reader presses a key or the pointer or the link changes.
	 */
	async function reveal(id: string): Promise<void> {
		await tick();
		const article = document.getElementById(`comment-${id}`);
		if (!article) return;
		(article.closest('[data-linked]') ?? article).scrollIntoView({ block: 'start' });
		article.focus({ preventScroll: true });
		comments.highlightId = id;
		// Next turn, so the keypress or click that led here does not clear it at once.
		setTimeout(() => {
			if (comments.highlightId !== id) return;
			document.addEventListener('pointerdown', clearHighlight);
			document.addEventListener('keydown', clearHighlight);
		});
	}

	/** Scrolls to the failed link's notice and moves the focus there. */
	async function showNotice(): Promise<void> {
		await tick();
		const notice = document.querySelector<HTMLElement>('[data-link-notice]');
		if (!notice) return;
		notice.scrollIntoView({ block: 'start' });
		notice.focus({ preventScroll: true });
	}

	$effect(() => {
		const id = pendingReveal;
		if (id === null || showSkeleton) return;
		untrack(() => {
			pendingReveal = null;
			void reveal(id);
		});
	});

	$effect(() => {
		if (!pendingNotice || showSkeleton) return;
		untrack(() => {
			pendingNotice = false;
			void showNotice();
		});
	});

	$effect(() => {
		if (comments.phase === 'ready' && !showSkeleton) drawn = true;
	});

	onMount(() => {
		// `load` sets the first-paint hint, so a reader who is probably signed in gets the
		// viewer state in parallel with the list instead of after `/api/me`.
		void session.load();
		void comments.load();
		if (session.likelyUser) void comments.loadViewer();
		// After `load`, so the link waits for the first page before it fetches a thread.
		void followLink();
		window.addEventListener('hashchange', followLink);
		return () => {
			window.removeEventListener('hashchange', followLink);
			clearHighlight();
		};
	});

	$effect(() => {
		if (session.status === 'user') {
			if (untrack(() => comments.viewerPhase) === 'idle') void untrack(() => comments.loadViewer());
		} else if (session.status === 'anon') {
			untrack(() => comments.clearViewer());
		}
	});

	const linkedRoot = $derived(comments.linked?.root ?? null);
	/** The reader's own comments that belong to the pinned thread are drawn there, not in the list. */
	const inLinked = (c: OwnComment) =>
		linkedRoot !== null && (c.id === linkedRoot.id || c.rootId === linkedRoot.id);
	const ownComments = $derived(comments.viewer?.comments ?? []);
	const pinned = $derived(
		linkedRoot && comments.linked
			? withReview(
					buildThreads([linkedRoot], ownComments.filter(inLinked), session.user),
					comments.linked.id,
					comments.linked.review
				)
			: []
	);
	/** The list without the pinned thread, which a later page may carry again. */
	const threads = $derived(
		buildThreads(
			comments.list.filter((root) => root.id !== linkedRoot?.id),
			ownComments.filter((c) => !inLinked(c)),
			session.user
		)
	);
	/** A reader who is probably signed in sees the list once their own comments are merged in, so none appears above it later. */
	const waitingForViewer = $derived(
		session.likelyUser && (comments.viewerPhase === 'idle' || comments.viewerPhase === 'loading')
	);
	let moreButton: HTMLButtonElement | undefined = $state();

	/** Loads the next page and puts the focus on its first comment, or back on the button if it failed. */
	async function showMore() {
		const before = comments.list.length;
		await comments.loadMore();
		const first = comments.list[before];
		await focusAfterUpdate(() =>
			first ? document.getElementById(`comment-${first.id}`) : moreButton
		);
	}

	/** Where `/auth` sends the reader back to after signing in. */
	const signInHref = $derived(
		`/auth?next=${encodeURIComponent(titleHref(kind, Number(tmdbId)) ?? '/')}`
	);
	/** A reader who is signed in waits for their viewer state before the composer shows, so a mute can replace it. */
	const viewerPending = $derived(
		comments.viewerPhase === 'idle' || comments.viewerPhase === 'loading'
	);

	const loading = $derived(comments.phase === 'loading' && comments.list.length === 0);
	const linkLoading = $derived(comments.busy.link ?? false);
	/** The first draw waits for a link's thread, so it does not push the list down; a drawn list stays. */
	const showSkeleton = $derived(
		loading ||
			(comments.phase === 'ready' && waitingForViewer) ||
			(comments.phase === 'ready' && linkLoading && !drawn)
	);
	const nothingShown = $derived(threads.length === 0 && pinned.length === 0);
	/** The pin's slot: the pinned thread, or its place while the thread loads over a drawn list. */
	const pinSlot = $derived(pinned.length > 0 || linkLoading);
</script>

<CollapsibleSection id="comments" title="Comments" openOnHash hashPrefix="comment-">
	<div class="comments">
		<p class="sr-only" aria-live="polite" aria-atomic="true" data-vote-status>
			{comments.announcement}
		</p>
		{#if session.status === 'user'}
			{#if viewerPending}
				<div class="composer-slot" aria-hidden="true"></div>
			{:else if comments.mutedUntil}
				<Notice tone="warn">
					This account is muted and cannot write, edit, delete, vote on or report comments until {formatDate(
						comments.mutedUntil
					)}.
				</Notice>
			{:else}
				<CommentComposer
					label="Write a comment"
					submitLabel="Comment"
					busy={comments.busy.compose}
					error={comments.errors.compose}
					onsubmit={(body) => comments.post(body)}
				/>
			{/if}
		{:else if session.status === 'anon'}
			<p class="sign-in"><a class="link" href={signInHref}>Sign in to comment</a></p>
		{:else}
			<div class="composer-slot" aria-hidden="true"></div>
		{/if}

		<div
			class="toolbar"
			class:toolbar--hidden={comments.phase === 'ready' && threads.length === 0}
			role="group"
			aria-label="Sort comments"
		>
			<span class="label">Sort</span>
			{#each SORTS as sort (sort.value)}
				<button
					class="chip"
					type="button"
					aria-pressed={comments.sort === sort.value}
					onclick={() => comments.setSort(sort.value)}
				>
					{sort.label}
				</button>
			{/each}
		</div>

		<div
			class="slot"
			data-comment-list
			tabindex="-1"
			class:slot--stale={comments.phase === 'loading' && comments.list.length > 0}
			aria-busy={comments.phase === 'loading' || waitingForViewer || (!drawn && linkLoading)}
		>
			{#if comments.phase === 'error'}
				<Notice tone="error">{comments.errors.load}</Notice>
				<button class="btn btn--ink retry" type="button" onclick={() => comments.load()}>
					Try again
				</button>
			{:else if showSkeleton}
				<div class="skeleton" role="status">
					<span class="sr-only">Loading comments</span>
					<div class="skeleton-row"></div>
					<div class="skeleton-row"></div>
					<div class="skeleton-row"></div>
				</div>
			{:else}
				{#if comments.errors.viewer}
					<Notice tone="error">{comments.errors.viewer}</Notice>
					<button class="btn btn--ink retry" type="button" onclick={() => comments.loadViewer()}>
						Try again
					</button>
				{/if}
				{#if comments.errors.link}
					<div class="link-notice" data-link-notice tabindex="-1">
						<Notice tone="warn">{comments.errors.link}</Notice>
						{#if comments.linkRetryable}
							<button class="btn btn--ink retry" type="button" onclick={followLink}>
								Try again
							</button>
						{/if}
					</div>
				{/if}
				{#if pinSlot}
					<section
						class="linked"
						data-linked
						aria-labelledby="linked-comment-label"
						aria-busy={linkLoading}
					>
						<p class="label" id="linked-comment-label">Linked comment</p>
						{#if pinned.length > 0}
							<CommentList threads={pinned} state={comments} />
						{:else}
							<div class="skeleton-row"></div>
						{/if}
					</section>
				{/if}
				{#if nothingShown}
					<p class="empty">No comments yet.</p>
				{:else if threads.length > 0}
					<CommentList {threads} state={comments} />
				{/if}
				{#if comments.nextCursor}
					<button
						class="btn btn--ink more"
						type="button"
						aria-busy={comments.busy.more ?? false}
						bind:this={moreButton}
						onclick={showMore}
					>
						Show more comments
					</button>
				{/if}
			{/if}
		</div>
	</div>
</CollapsibleSection>

<style lang="postcss">
	@reference "../../../app.css";

	.comments {
		@apply flex flex-col;
		gap: var(--spacing-md);
	}

	/*
	 * While the session resolves: the sign-in line's height, or, for a reader probably signed
	 * in (app.html and the session set data-hint before the first paint), the composer's: the
	 * field, the gap and the button row.
	 */
	.composer-slot {
		height: 1.5rem;
	}

	:global(:root[data-hint='user']) .composer-slot {
		height: calc(var(--comment-field-height) + var(--spacing-sm) + 2.5rem);
	}

	.sign-in {
		@apply text-sm;
		min-height: 1.5rem;
	}

	.sign-in .link {
		@apply inline-flex items-center;
		min-height: 1.5rem;
	}

	.toolbar {
		@apply flex items-center;
		gap: var(--spacing-sm);
	}

	/* An empty list has nothing to sort; the row keeps its height so nothing moves. */
	.toolbar--hidden {
		visibility: hidden;
	}

	/* A touch target is 44px on a coarse pointer, like the buttons. */
	@media (pointer: coarse) {
		.composer-slot,
		.sign-in,
		.sign-in .link {
			min-height: 2.75rem;
		}

		.composer-slot {
			height: 2.75rem;
		}

		:global(:root[data-hint='user']) .composer-slot {
			height: calc(var(--comment-field-height) + var(--spacing-sm) + 2.75rem);
		}
	}

	.chip[aria-pressed='true'] {
		border-color: var(--brand);
		color: var(--brand);
	}

	/* Room for three skeleton rows, so the list replaces them without moving what is below. */
	.slot {
		@apply flex flex-col;
		min-height: 7.125rem;
		gap: var(--spacing-sm);
		transition: opacity 0.15s ease;
	}

	.slot--stale {
		opacity: 0.55;
	}

	.empty {
		@apply text-ink-muted;
	}

	/* The pinned thread sits above the list, set off by one hairline and a medium gap, and scrolls clear of the sticky header. */
	.linked {
		@apply flex flex-col border-b border-border;
		padding-bottom: var(--spacing-xs);
		/* The slot's gap makes the space below the hairline a full medium gap. */
		margin-bottom: calc(var(--spacing-md) - var(--spacing-sm));
		scroll-margin-top: 5rem;
	}

	.link-notice {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		scroll-margin-top: 5rem;
	}

	.retry,
	.more {
		@apply self-start;
	}

	.skeleton {
		@apply flex flex-col;
	}

	.skeleton-row {
		@apply flex items-center border-b border-border;
		height: 2.375rem;
		animation: pulse 1.6s ease-in-out infinite;
	}

	.skeleton-row::before {
		content: '';
		width: 40%;
		height: 0.75rem;
		background-color: var(--surface-sunken);
	}

	@keyframes pulse {
		50% {
			opacity: 0.5;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.slot {
			transition: none;
		}

		.skeleton-row {
			animation: none;
		}
	}
</style>
