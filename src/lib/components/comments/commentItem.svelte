<script lang="ts">
	import Avatar from '#lib/components/user/avatars/Avatar.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import CommentAction from './commentAction.svelte';
	import CommentConfirm from './commentConfirm.svelte';
	import CommentComposer from './commentComposer.svelte';
	import { unpublishedNote } from '#lib/media/utils/comments.ts';
	import CommentReportForm from './commentReportForm.svelte';
	import { COMMENT_STATUS_LABELS } from '#lib/media/utils/comments.ts';
	import type { ShownComment } from '#lib/media/utils/commentThread.ts';
	import type { CommentsState } from '#lib/media/utils/commentsState.svelte.js';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
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
	let root: HTMLElement | undefined = $state();

	const signedIn = $derived(session.status === 'user');
	const own = $derived(
		comment.review !== null ||
			(session.user !== null && comment.author !== null && comment.author.id === session.user.id)
	);
	const vote = $derived(comments.voteOf(comment.id));
	/** A muted account cannot write, edit, delete, vote or report until the mute ends. */
	const muted = $derived(comments.mutedUntil !== null);
	const canVote = $derived(signedIn && !own && !comment.removed);
	const role = $derived(
		comment.author?.role === 'moderator'
			? 'Moderator'
			: comment.author?.role === 'administrator'
				? 'Administrator'
				: null
	);
	const replyKey = $derived(`reply:${comment.id}`);
	const editKey = $derived(`edit:${comment.id}`);
	const deleteKey = $derived(`delete:${comment.id}`);

	const toggle = (next: NonNullable<typeof mode>) => (mode = mode === next ? null : next);

	/** The comments next to this one, in the order focus falls back to when this one leaves the list. */
	function neighbourIds(): string[] {
		const all = [...document.querySelectorAll<HTMLElement>('article[id^="comment-"]')];
		const at = root ? all.indexOf(root) : -1;
		return [all[at + 1]?.id, all[at - 1]?.id].filter((id): id is string => Boolean(id));
	}

	/** Closes the panel after it did its work, and puts the focus on the comment it acted on. */
	async function closeAndFocus(): Promise<void> {
		mode = null;
		await focusAfterUpdate(() => root);
	}

	async function saveEdit(body: string): Promise<boolean> {
		const ok = await comments.edit(comment.id, body);
		if (ok) await closeAndFocus();
		return ok;
	}

	async function sendReply(body: string): Promise<boolean> {
		const ok = await comments.post(body, comment.id);
		if (ok) await closeAndFocus();
		return ok;
	}

	/**
	 * Deletes the comment. It stays as a placeholder while it has replies, so the focus goes to
	 * it; otherwise it leaves the list, and the focus goes to the next comment, the previous one,
	 * or the list itself.
	 */
	async function remove(): Promise<void> {
		const neighbours = neighbourIds();
		const list = root?.closest<HTMLElement>('[data-comment-list]');
		if (!(await comments.remove(comment.id))) return;
		mode = null;
		await focusAfterUpdate(
			() =>
				(comment.removed ? root : undefined) ??
				neighbours.map((id) => document.getElementById(id)).find((el) => el !== null) ??
				list
		);
	}
</script>

<article class="comment" id="comment-{comment.id}" tabindex="-1" bind:this={root}>
	{#if comment.removed}
		<p class="removed">This comment was removed.</p>
	{:else}
		<header class="meta">
			<Avatar avatarKey={comment.author?.avatarKey} size={28} />
			<span class="name">{comment.author?.displayName ?? 'Account'}</span>
			{#if own && !comment.review}<Badge tone="brand">Author</Badge>{/if}
			{#if role}<Badge tone="brand">{role}</Badge>{/if}
			<time class="label" datetime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
			{#if comment.editedAt}<span class="label">Edited</span>{/if}
			{#if comment.review}
				<Badge tone={commentStatusTone(comment.review.status)}>
					{COMMENT_STATUS_LABELS[comment.review.status]}
				</Badge>
			{/if}
		</header>

		{#if comment.inReplyTo}
			<p class="label">In reply to {comment.inReplyTo.displayName}</p>
		{/if}

		{#if mode === 'edit'}
			<CommentComposer
				label="Edit comment"
				submitLabel="Save"
				initial={comment.body ?? ''}
				busy={comments.busy[editKey]}
				error={comments.errors[editKey]}
				hint="Saving runs moderation again."
				nested
				autofocus
				onsubmit={saveEdit}
				oncancel={() => (mode = null)}
			/>
		{:else}
			<p class="body">{comment.body}</p>
		{/if}

		{#if comment.review?.status === 'pending'}
			<p class="label">{unpublishedNote('pending', null)}</p>
		{:else if comment.review?.status === 'rejected'}
			<p class="label">{unpublishedNote('rejected', comment.review.reason)}</p>
		{/if}
	{/if}

	{#if !comment.removed}
		<div class="actions">
			{#if !comment.review}
				{#if canVote}
					<div class="votes" role="group" aria-label="Vote on this comment">
						<CommentAction
							icon
							label="Upvote"
							pressed={vote === 1}
							disabled={muted}
							onclick={() => comments.vote(comment.id, 1)}
						>
							<i class="ri-arrow-up-line" aria-hidden="true"></i>
						</CommentAction>
						<span class="score"><span class="sr-only">Score</span> {comment.score}</span>
						<CommentAction
							icon
							label="Downvote"
							pressed={vote === -1}
							disabled={muted}
							onclick={() => comments.vote(comment.id, -1)}
						>
							<i class="ri-arrow-down-line" aria-hidden="true"></i>
						</CommentAction>
					</div>
				{:else}
					<span class="score score--alone">Score {comment.score}</span>
				{/if}
			{/if}

			{#if signedIn && !comment.review}
				<CommentAction disabled={muted} expanded={mode === 'reply'} onclick={() => toggle('reply')}
					>Reply</CommentAction
				>
			{/if}
			{#if own}
				<CommentAction disabled={muted} expanded={mode === 'edit'} onclick={() => toggle('edit')}
					>Edit</CommentAction
				>
				<CommentAction
					disabled={muted}
					expanded={mode === 'delete'}
					onclick={() => toggle('delete')}
				>
					Delete
				</CommentAction>
			{:else if signedIn}
				<CommentAction
					disabled={muted}
					expanded={mode === 'report'}
					onclick={() => toggle('report')}
				>
					Report
				</CommentAction>
			{/if}
		</div>
	{/if}

	{#if !comment.removed}
		{#if mode === 'reply'}
			<CommentComposer
				label="Reply to {comment.author?.displayName ?? 'this comment'}"
				submitLabel="Reply"
				busy={comments.busy[replyKey]}
				error={comments.errors[replyKey]}
				nested
				autofocus
				onsubmit={sendReply}
				oncancel={() => (mode = null)}
			/>
		{/if}
		{#if mode === 'report'}
			<CommentReportForm
				commentId={comment.id}
				state={comments}
				onclose={() => (mode = null)}
				onsent={closeAndFocus}
			/>
		{/if}
		{#if mode === 'delete'}
			<CommentConfirm
				message="Delete this comment? Other readers no longer see its text, and it cannot be restored.{comment.replyCount >
				0
					? ' Replies stay under a placeholder.'
					: ''}"
				confirmLabel="Delete comment"
				cancelLabel="Keep comment"
				busy={comments.busy[deleteKey]}
				onconfirm={remove}
				oncancel={() => (mode = null)}
			/>
		{/if}
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
		@apply text-ink-muted font-normal;
		padding-inline: var(--spacing-sm);
	}
</style>
