<script lang="ts">
	import Badge from '#lib/components/ui/badge.svelte';
	import CommentLink from '#lib/components/comments/commentLink.svelte';
	import ProfileTitleLink from '#lib/components/user/profileTitleLink.svelte';
	import type { AccountComment } from '#lib/media/types/moderation.ts';
	import { COMMENT_STATUS_LABELS, hiddenNote, unpublishedNote } from '#lib/media/utils/comments.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { commentHref } from '#lib/media/utils/titleHref.ts';
	import { commentStatusTone } from '#lib/media/utils/tones.ts';

	interface Props {
		comment: AccountComment;
	}

	let { comment }: Props = $props();

	const permalink = $derived(commentHref(comment.title.kind, comment.title.tmdbId, comment.id));
</script>

<li class="row">
	<div class="meta">
		<ProfileTitleLink
			kind={comment.title.kind}
			tmdbId={comment.title.tmdbId}
			name={comment.title.name}
		/>
		<time class="label" datetime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
		{#if permalink}<CommentLink href={permalink} />{/if}
		{#if comment.isReply}<span class="label">Reply</span>{/if}
		{#if comment.editedAt}<span class="label">Edited</span>{/if}
		<Badge tone={commentStatusTone(comment.status)}>{COMMENT_STATUS_LABELS[comment.status]}</Badge>
	</div>
	<p class="body">{comment.body}</p>
	{#if comment.status === 'rejected'}
		<p class="label">
			{unpublishedNote('rejected', comment.moderationReason, comment.moderationRule)}
		</p>
	{:else if comment.status === 'hidden'}
		<p class="label">{hiddenNote(comment.moderationReason, comment.moderationRule)}</p>
	{/if}
</li>

<style lang="postcss">
	@reference "../../../../app.css";

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
		@apply line-clamp-3;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
