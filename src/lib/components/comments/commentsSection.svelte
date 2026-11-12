<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import CollapsibleSection from '#lib/components/movies/sections/collapsibleSection.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import CommentComposer from './commentComposer.svelte';
	import CommentList from './commentList.svelte';
	import type { CommentSort } from '#lib/media/types/comments.ts';
	import { buildThreads } from '#lib/media/utils/commentThread.ts';
	import { CommentsState } from '#lib/media/utils/commentsState.svelte.js';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { session } from '#lib/media/utils/session.svelte.js';

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

	onMount(() => {
		// `load` sets the first-paint hint, so a reader who is probably signed in gets the
		// viewer state in parallel with the list instead of after `/api/me`.
		void session.load();
		void comments.load();
		if (session.likelyUser) void comments.loadViewer();
	});

	$effect(() => {
		if (session.status === 'user') {
			if (untrack(() => comments.viewerPhase) === 'idle') void untrack(() => comments.loadViewer());
		} else if (session.status === 'anon') {
			untrack(() => comments.clearViewer());
		}
	});

	const threads = $derived(
		buildThreads(comments.list, comments.viewer?.comments ?? [], session.user)
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

	const loading = $derived(comments.phase === 'loading' && comments.list.length === 0);
	const showSkeleton = $derived(loading || (comments.phase === 'ready' && waitingForViewer));
</script>

<CollapsibleSection title="Comments">
	<div class="comments">
		{#if session.status === 'user'}
			<CommentComposer
				label="Write a comment"
				submitLabel="Comment"
				busy={comments.busy.compose}
				error={comments.errors.compose}
				notice={comments.notices.compose}
				onsubmit={(body) => comments.post(body)}
			/>
		{:else if session.status === 'anon'}
			<p class="sign-in"><a class="link" href="/auth">Sign in to comment</a></p>
		{:else}
			<div class="composer-slot" aria-hidden="true"></div>
		{/if}

		<div class="toolbar" role="group" aria-label="Sort comments">
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
			aria-busy={comments.phase === 'loading' || waitingForViewer}
		>
			{#if comments.phase === 'error'}
				<Notice tone="error">{comments.errors.load}</Notice>
				<button class="btn btn--ghost retry" type="button" onclick={() => comments.load()}>
					Try again
				</button>
			{:else if showSkeleton}
				<div class="skeleton" aria-label="Loading comments">
					<div class="skeleton-row"></div>
					<div class="skeleton-row"></div>
					<div class="skeleton-row"></div>
				</div>
			{:else}
				{#if comments.errors.viewer}
					<Notice tone="error">{comments.errors.viewer}</Notice>
				{/if}
				{#if threads.length === 0}
					<p class="empty">No comments yet.</p>
				{:else}
					<CommentList {threads} state={comments} />
				{/if}
				{#if comments.nextCursor}
					<button
						class="btn btn--ghost more"
						type="button"
						disabled={comments.busy.more}
						bind:this={moreButton}
						onclick={showMore}
					>
						{comments.busy.more ? 'Loading…' : 'Show more comments'}
					</button>
					{#if comments.errors.more}
						<Notice tone="error">{comments.errors.more}</Notice>
					{/if}
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

	/* A touch target is 44px on a coarse pointer, like the buttons. */
	@media (pointer: coarse) {
		.chip {
			height: 2.75rem;
		}

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

	.retry,
	.more {
		@apply self-start;
	}

	.skeleton {
		@apply flex flex-col;
	}

	.skeleton-row {
		@apply border-b border-border;
		height: 2.375rem;
		background: linear-gradient(var(--surface-sunken), var(--surface-sunken)) left center / 40%
			0.75rem no-repeat;
		animation: pulse 1.6s ease-in-out infinite;
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
