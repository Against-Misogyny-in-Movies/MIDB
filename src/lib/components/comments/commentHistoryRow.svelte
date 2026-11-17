<script lang="ts">
	import Badge from '#lib/components/ui/badge.svelte';
	import ProfileTitleLink from '#lib/components/user/profileTitleLink.svelte';
	import CommentAction from './commentAction.svelte';
	import CommentConfirm from './commentConfirm.svelte';
	import CommentComposer from './commentComposer.svelte';
	import CommentLink from './commentLink.svelte';
	import { COMMENT_STATUS_LABELS, unpublishedNote } from '#lib/media/utils/comments.ts';
	import type { UserCommentRow } from '#lib/media/types/comments.ts';
	import { OwnCommentEditing } from '#lib/media/utils/ownCommentEditing.svelte.js';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { commentHref } from '#lib/media/utils/titleHref.ts';
	import { commentStatusTone } from '#lib/media/utils/tones.ts';

	interface Props {
		comment: UserCommentRow;
	}

	let { comment: initial }: Props = $props();

	// The row keeps its own copy: an edit or a delete changes it from the response.
	// svelte-ignore state_referenced_locally
	let comment = $state<UserCommentRow>(initial);
	let root: HTMLElement | undefined = $state();
	const editing = new OwnCommentEditing({
		id: () => comment.id,
		edited: (saved) => (comment = { ...comment, ...saved }),
		deleted: () => (comment = { ...comment, status: 'deleted' }),
		settled: () => focusAfterUpdate(() => root)
	});

	/** A hidden or deleted comment cannot be edited (the endpoint answers 409). */
	const editable = $derived(comment.status !== 'hidden' && comment.status !== 'deleted');
	const deletable = $derived(comment.status !== 'deleted');
	const permalink = $derived(commentHref(comment.kind, comment.tmdbId, comment.id));
</script>

<li class="row" id="comment-{comment.id}" tabindex="-1" bind:this={root}>
	<div class="meta">
		<ProfileTitleLink kind={comment.kind} tmdbId={comment.tmdbId} name={comment.title} />
		<time class="label" datetime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
		{#if permalink}<CommentLink href={permalink} />{/if}
		{#if comment.parentId}<span class="label">Reply</span>{/if}
		{#if comment.editedAt}<span class="label">Edited</span>{/if}
		{#if comment.status === 'published'}<span class="label num">Score {comment.score}</span>{/if}
		{#if comment.status !== 'published'}
			<Badge tone={commentStatusTone(comment.status)}>{COMMENT_STATUS_LABELS[comment.status]}</Badge
			>
		{/if}
	</div>

	{#if editing.mode === 'edit'}
		<CommentComposer
			label="Edit comment"
			submitLabel="Save"
			initial={comment.body}
			busy={editing.busy}
			error={editing.error}
			hint="Saving runs moderation again."
			nested
			autofocus
			onsubmit={(body) => editing.save(body)}
			oncancel={() => editing.cancel()}
		/>
	{:else}
		<p class="body">{comment.body}</p>
	{/if}

	{#if comment.status === 'rejected'}
		<p class="label">{unpublishedNote('rejected', comment.moderationReason)}</p>
	{:else if comment.status === 'hidden'}
		<p class="label">
			A moderator hid this comment.{comment.moderationReason
				? ` Reason: ${comment.moderationReason}`
				: ''}
		</p>
	{/if}

	{#if editable || deletable}
		<div class="actions">
			{#if editable}
				<CommentAction expanded={editing.mode === 'edit'} onclick={() => editing.toggle('edit')}
					>Edit</CommentAction
				>
			{/if}
			{#if deletable}
				<CommentAction
					expanded={editing.mode === 'delete'}
					onclick={() => editing.toggle('delete')}
				>
					Delete
				</CommentAction>
			{/if}
		</div>
	{/if}

	{#if editing.mode === 'delete'}
		<CommentConfirm
			message="Delete this comment? Other readers no longer see its text. It stays here, marked as deleted.{comment.replyCount >
			0
				? ' Replies stay under a placeholder.'
				: ''}"
			confirmLabel="Delete comment"
			cancelLabel="Keep comment"
			busy={editing.busy}
			onconfirm={() => editing.remove()}
			oncancel={() => editing.cancel()}
		/>
	{/if}
</li>

<style lang="postcss">
	@reference "../../../app.css";

	/* Focused after an edit or a delete; the ring sits inside, so a clipping card does not cut it. */
	.row:focus-visible {
		outline-offset: -2px;
	}

	.row {
		@apply flex flex-col;
		gap: var(--spacing-xs);
		padding: var(--spacing-md) 20px;
	}

	.meta {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.body {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.actions {
		@apply flex;
		gap: var(--spacing-xs);
		margin-left: calc(var(--spacing-sm) * -1);
	}
</style>
