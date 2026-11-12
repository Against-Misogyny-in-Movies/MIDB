<script lang="ts">
	import Avatar from '#lib/components/user/avatars/Avatar.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import CommentComposer from './commentComposer.svelte';
	import CommentReportForm from './commentReportForm.svelte';
	import { COMMENT_STATUS_LABELS } from '#lib/media/utils/comments.ts';
	import type { ShownComment } from '#lib/media/utils/commentThread.ts';
	import type { CommentsState } from '#lib/media/utils/commentsState.svelte.js';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { session } from '#lib/media/utils/session.svelte.js';
	import { commentStatusTone } from '#lib/media/utils/tones.ts';

	interface Props {
		comment: ShownComment;
		state: CommentsState;
	}

	let { comment, state: comments }: Props = $props();

	/** The one open panel under the comment. */
	let mode = $state<'reply' | 'edit' | 'report' | 'delete' | null>(null);

	const signedIn = $derived(session.status === 'user');
	const own = $derived(
		comment.review !== null ||
			(session.user !== null && comment.author !== null && comment.author.id === session.user.id)
	);
	const vote = $derived(comments.voteOf(comment.id));
	const canVote = $derived(signedIn && !own && !comment.removed);
	const role = $derived(
		comment.author?.role === 'moderator'
			? 'Moderator'
			: comment.author?.role === 'administrator'
				? 'Administrator'
				: null
	);
	const voteKey = $derived(`vote:${comment.id}`);
	const replyKey = $derived(`reply:${comment.id}`);
	const editKey = $derived(`edit:${comment.id}`);
	const deleteKey = $derived(`delete:${comment.id}`);

	const toggle = (next: NonNullable<typeof mode>) => (mode = mode === next ? null : next);

	async function saveEdit(body: string): Promise<boolean> {
		const ok = await comments.edit(comment.id, body);
		if (ok) mode = null;
		return ok;
	}

	async function sendReply(body: string): Promise<boolean> {
		const ok = await comments.post(body, comment.id);
		if (ok) mode = null;
		return ok;
	}

	async function confirmDelete() {
		await comments.remove(comment.id);
	}
</script>

<article class="comment" id="comment-{comment.id}">
	{#if comment.removed}
		<p class="removed">This comment was removed.</p>
	{:else}
		<header class="meta">
			<Avatar avatarKey={comment.author?.avatarKey} size={28} />
			<span class="name">{comment.author?.displayName ?? 'Account'}</span>
			{#if own && !comment.review}<Badge tone="brand">You</Badge>{/if}
			{#if role}<Badge tone="brand">{role}</Badge>{/if}
			<time class="label" datetime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
			{#if comment.editedAt}<span class="label">edited</span>{/if}
			{#if comment.review}
				<Badge tone={commentStatusTone(comment.review.status)}>
					{COMMENT_STATUS_LABELS[comment.review.status]}
				</Badge>
			{/if}
		</header>

		{#if comment.inReplyTo}
			<p class="label">in reply to @{comment.inReplyTo.displayName}</p>
		{/if}

		{#if mode === 'edit'}
			<CommentComposer
				label="Edit comment"
				submitLabel="Save"
				initial={comment.body ?? ''}
				busy={comments.busy[editKey]}
				error={comments.errors[editKey]}
				hint="Saving runs moderation again."
				autofocus
				onsubmit={saveEdit}
				oncancel={() => (mode = null)}
			/>
		{:else}
			<p class="body">{comment.body}</p>
		{/if}

		{#if comment.review?.status === 'pending'}
			<p class="label">Only you can see this comment until it is reviewed.</p>
		{:else if comment.review?.status === 'rejected'}
			<p class="label">
				Only you can see this comment.{comment.review.reason
					? ` Reason: ${comment.review.reason}`
					: ''}
			</p>
		{/if}
	{/if}

	{#if !comment.removed}
		<div class="actions">
			{#if !comment.review}
				{#if canVote}
					<div class="votes" role="group" aria-label="Vote on this comment">
						<button
							class="action action--icon"
							type="button"
							aria-label="Upvote"
							aria-pressed={vote === 1}
							disabled={comments.busy[voteKey]}
							onclick={() => comments.vote(comment.id, 1)}
						>
							<i class="ri-arrow-up-line" aria-hidden="true"></i>
						</button>
						<span class="score" aria-label="Score {comment.score}">{comment.score}</span>
						<button
							class="action action--icon"
							type="button"
							aria-label="Downvote"
							aria-pressed={vote === -1}
							disabled={comments.busy[voteKey]}
							onclick={() => comments.vote(comment.id, -1)}
						>
							<i class="ri-arrow-down-line" aria-hidden="true"></i>
						</button>
					</div>
				{:else}
					<span class="score score--alone" aria-label="Score {comment.score}">{comment.score}</span>
				{/if}
			{/if}

			{#if signedIn && !comment.removed && !comment.review}
				<button
					class="action"
					type="button"
					aria-expanded={mode === 'reply'}
					onclick={() => toggle('reply')}
				>
					Reply
				</button>
			{/if}
			{#if own && !comment.removed}
				<button
					class="action"
					type="button"
					aria-expanded={mode === 'edit'}
					onclick={() => toggle('edit')}
				>
					Edit
				</button>
				<button
					class="action"
					type="button"
					aria-expanded={mode === 'delete'}
					onclick={() => toggle('delete')}
				>
					Delete
				</button>
			{:else if signedIn && !comment.removed}
				<button
					class="action"
					type="button"
					aria-expanded={mode === 'report'}
					onclick={() => toggle('report')}
				>
					Report
				</button>
			{/if}
		</div>
	{/if}

	{#if comments.errors[voteKey]}
		<Notice tone="error">{comments.errors[voteKey]}</Notice>
	{/if}
	{#if mode === 'reply'}
		<CommentComposer
			label="Reply to {comment.author?.displayName ?? 'this comment'}"
			submitLabel="Reply"
			busy={comments.busy[replyKey]}
			error={comments.errors[replyKey]}
			autofocus
			onsubmit={sendReply}
			oncancel={() => (mode = null)}
		/>
	{:else if comments.notices[replyKey]}
		<Notice tone="success">{comments.notices[replyKey]}</Notice>
	{/if}
	{#if mode === 'report'}
		<CommentReportForm commentId={comment.id} state={comments} onclose={() => (mode = null)} />
	{/if}
	{#if mode === 'delete'}
		<div class="confirm">
			<p class="text-sm">
				Delete this comment? Its text is removed from the page and cannot be restored.{comment.replyCount >
				0
					? ' Replies stay under a placeholder.'
					: ''}
			</p>
			<div class="row">
				<button
					class="btn btn--ink"
					type="button"
					disabled={comments.busy[deleteKey]}
					onclick={confirmDelete}
				>
					{comments.busy[deleteKey] ? 'Deleting…' : 'Delete comment'}
				</button>
				<button class="btn btn--ghost" type="button" onclick={() => (mode = null)}>
					Keep comment
				</button>
			</div>
			{#if comments.errors[deleteKey]}
				<Notice tone="error">{comments.errors[deleteKey]}</Notice>
			{/if}
		</div>
	{/if}
</article>

<style lang="postcss">
	@reference "../../../app.css";

	.comment {
		@apply flex flex-col;
		gap: var(--spacing-xs);
		padding-block: var(--spacing-sm);
		scroll-margin-top: 5rem;
	}

	.meta {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.name {
		@apply font-semibold;
	}

	.body {
		@apply text-base;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.removed {
		@apply text-sm text-ink-muted;
	}

	.actions {
		@apply flex flex-wrap items-center;
		min-height: 2rem;
		gap: var(--spacing-xs);
	}

	.votes {
		@apply inline-flex items-center;
	}

	.score {
		@apply text-sm font-medium text-center;
		min-width: 1.5rem;
		font-variant-numeric: tabular-nums;
	}

	.score--alone {
		@apply text-ink-muted;
		padding-inline: var(--spacing-sm);
	}

	/* A quiet text action: no fill until hovered; icon-only votes are square. */
	.action {
		@apply inline-flex items-center justify-center text-sm font-medium text-ink-muted;
		min-height: 2rem;
		padding-inline: var(--spacing-sm);
		border: 0;
		border-radius: 8px;
		background: none;
		cursor: pointer;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.action:hover:not(:disabled) {
		@apply text-ink;
		background-color: var(--surface-sunken);
	}

	.action:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.action--icon {
		min-width: 2rem;
		padding-inline: 0;
		font-size: 1.125rem;
	}

	.action[aria-pressed='true'] {
		color: var(--brand);
		background-color: color-mix(in oklab, var(--brand) 14%, transparent);
	}

	.confirm {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		border-radius: 12px;
		background-color: var(--surface-sunken);
	}

	.row {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}

	@media (pointer: coarse) {
		.action {
			min-height: 2.75rem;
		}

		.action--icon {
			min-width: 2.75rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.action {
			transition: none;
		}
	}
</style>
