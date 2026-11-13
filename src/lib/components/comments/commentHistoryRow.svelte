<script lang="ts">
	import Badge from '#lib/components/ui/badge.svelte';
	import CommentAction from './commentAction.svelte';
	import CommentConfirm from './commentConfirm.svelte';
	import CommentComposer from './commentComposer.svelte';
	import { unpublishedNote } from '#lib/media/utils/comments.ts';
	import type { OwnComment, UserCommentRow } from '#lib/media/types/comments.ts';
	import { describeFailure, requestJson } from '#lib/media/utils/commentApi.ts';
	import { COMMENT_STATUS_LABELS } from '#lib/media/utils/comments.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { titleHref } from '#lib/media/utils/titleHref.ts';
	import { toasts } from '#lib/media/utils/toasts.svelte.js';
	import { commentStatusTone } from '#lib/media/utils/tones.ts';

	interface Props {
		comment: UserCommentRow;
	}

	let { comment: initial }: Props = $props();

	// The row keeps its own copy: an edit or a delete changes it from the response.
	// svelte-ignore state_referenced_locally
	let comment = $state<UserCommentRow>(initial);
	let mode = $state<'edit' | 'delete' | null>(null);
	let root: HTMLElement | undefined = $state();
	let busy = $state(false);
	/** The server refused the edited text (a 400): shown under the field. Other failures are toasts. */
	let error = $state<string | undefined>();

	/** A hidden or deleted comment cannot be edited (the endpoint answers 409). */
	const editable = $derived(comment.status !== 'hidden' && comment.status !== 'deleted');
	const deletable = $derived(comment.status !== 'deleted');
	const href = $derived(titleHref(comment.kind, comment.tmdbId));

	function toggle(next: 'edit' | 'delete') {
		mode = mode === next ? null : next;
		error = undefined;
	}

	async function save(body: string): Promise<boolean> {
		busy = true;
		error = undefined;
		const reply = await requestJson<{ comment: OwnComment }>(
			fetch,
			'PATCH',
			`/api/comments/${comment.id}`,
			{ body }
		);
		busy = false;
		if (!reply.ok) {
			const message = describeFailure('edit', reply.status, reply.message);
			if (reply.status === 400) error = message;
			else toasts.error(message);
			return false;
		}
		const saved = reply.data.comment;
		comment = {
			...comment,
			body: saved.body,
			status: saved.status,
			moderationReason: saved.moderationReason,
			editedAt: saved.editedAt
		};
		mode = null;
		await focusAfterUpdate(() => root);
		return true;
	}

	async function remove() {
		busy = true;
		const reply = await requestJson<{ ok: true }>(fetch, 'DELETE', `/api/comments/${comment.id}`);
		busy = false;
		if (!reply.ok) {
			toasts.error(describeFailure('delete', reply.status, reply.message));
			return;
		}
		comment = { ...comment, status: 'deleted' };
		mode = null;
		await focusAfterUpdate(() => root);
	}
</script>

<li class="row" id="comment-{comment.id}" tabindex="-1" bind:this={root}>
	<div class="meta">
		<Badge tone={commentStatusTone(comment.status)}>{COMMENT_STATUS_LABELS[comment.status]}</Badge>
		<time class="label" datetime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
		{#if comment.editedAt}<span class="label">Edited</span>{/if}
		<span class="label">
			{comment.parentId ? 'Reply on' : 'On'}
			{#if href}<a class="link" {href}>{comment.title}</a>{:else}{comment.title}{/if}
		</span>
	</div>

	{#if mode === 'edit'}
		<CommentComposer
			label="Edit comment"
			submitLabel="Save"
			initial={comment.body}
			{busy}
			{error}
			hint="Saving runs moderation again."
			nested
			autofocus
			onsubmit={save}
			oncancel={() => ((mode = null), (error = undefined))}
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
				<CommentAction expanded={mode === 'edit'} onclick={() => toggle('edit')}>Edit</CommentAction
				>
			{/if}
			{#if deletable}
				<CommentAction expanded={mode === 'delete'} onclick={() => toggle('delete')}>
					Delete
				</CommentAction>
			{/if}
		</div>
	{/if}

	{#if mode === 'delete'}
		<CommentConfirm
			message="Delete this comment? Other readers no longer see its text. It stays here, marked as deleted.{comment.replyCount >
			0
				? ' Replies stay under a placeholder.'
				: ''}"
			confirmLabel="Delete comment"
			cancelLabel="Keep comment"
			{busy}
			onconfirm={remove}
			oncancel={() => (mode = null)}
		/>
	{/if}
</li>

<style lang="postcss">
	@reference "../../../app.css";

	.row {
		@apply flex flex-col;
		gap: var(--spacing-xs);
		padding: 14px 20px;
	}

	.meta {
		@apply flex flex-wrap items-center;
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
