<script lang="ts">
	import Badge from '#lib/components/ui/badge.svelte';
	import CommentLink from '#lib/components/comments/commentLink.svelte';
	import CommentMenu from '#lib/components/comments/commentMenu.svelte';
	import OwnCommentDelete from '#lib/components/comments/ownCommentDelete.svelte';
	import OwnCommentEdit from '#lib/components/comments/ownCommentEdit.svelte';
	import ProfileLink from '#lib/components/user/profileLink.svelte';
	import ProfileTitleLink from '#lib/components/user/profileTitleLink.svelte';
	import type { ProfileComment } from '#lib/media/types/profile.ts';
	import { COMMENT_STATUS_LABELS, unpublishedNote } from '#lib/media/utils/comments.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import {
		OwnCommentEditing,
		type EditedComment
	} from '#lib/media/utils/ownCommentEditing.svelte.js';
	import { commentHref } from '#lib/media/utils/titleHref.ts';
	import { commentStatusTone } from '#lib/media/utils/tones.ts';

	interface Props {
		comment: ProfileComment;
		/**
		 * Set when the reader owns the comment (the owner's private view has loaded): the row gains
		 * a menu with Edit and Delete in its corner, which every row already reserves.
		 */
		own?: { replyCount: number } | null;
	}

	let { comment, own = null }: Props = $props();

	/** What an edit or a delete by the owner changed on the row; the cached page does not carry it. */
	let changed = $state<Partial<EditedComment> | null>(null);
	const body = $derived(changed?.body ?? comment.body);
	const status = $derived(changed?.status ?? 'published');
	const edited = $derived(comment.edited || changed?.editedAt != null);
	const reason = $derived(changed?.moderationReason ?? null);
	const rule = $derived(changed?.moderationRule ?? null);
	const permalink = $derived(commentHref(comment.title.kind, comment.title.tmdbId, comment.id));
	const rowId = $derived(`profile-comment-${comment.id}`);

	const editing = new OwnCommentEditing({
		id: () => comment.id,
		edited: (saved) => (changed = saved),
		deleted: () => (changed = { ...changed, status: 'deleted' }),
		settled: () => focusAfterUpdate(() => document.getElementById(rowId))
	});

	const menuItems = $derived(
		status === 'deleted'
			? []
			: [
					{
						label: 'Edit',
						expanded: editing.mode === 'edit',
						onselect: () => editing.toggle('edit')
					},
					{
						label: 'Delete',
						expanded: editing.mode === 'delete',
						onselect: () => editing.toggle('delete')
					}
				]
	);

	/** Closes a panel without acting and puts the focus back on the menu button, which its item left with the menu. */
	function cancel() {
		editing.cancel();
		void focusAfterUpdate(() =>
			document.getElementById(rowId)?.querySelector<HTMLElement>('.more button')
		);
	}
</script>

<p class="line">
	<ProfileTitleLink
		kind={comment.title.kind}
		tmdbId={comment.title.tmdbId}
		name={comment.title.name}
	/>
	<time class="label" datetime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
	{#if permalink}<CommentLink href={permalink} />{/if}
	{#if edited}<span class="label">Edited</span>{/if}
	{#if status === 'published'}
		<span class="label num">Score {comment.score}</span>
	{:else}
		<Badge tone={commentStatusTone(status)}>{COMMENT_STATUS_LABELS[status]}</Badge>
	{/if}
</p>
{#if comment.inReplyTo}
	<p class="label">
		In reply to <ProfileLink
			username={comment.inReplyTo.username}
			name={comment.inReplyTo.displayName}
		/>
	</p>
{/if}
{#if editing.mode === 'edit'}
	<OwnCommentEdit {editing} {body} oncancel={cancel} />
{:else}
	<p class="body">{body}</p>
{/if}
{#if status === 'rejected'}
	<p class="label">{unpublishedNote('rejected', reason, rule)}</p>
{/if}
{#if own && menuItems.length > 0}
	<span class="more">
		<CommentMenu label="More actions on the comment on {comment.title.name}" items={menuItems} />
	</span>
{/if}
{#if own && editing.mode === 'delete'}
	<OwnCommentDelete {editing} replyCount={own.replyCount} oncancel={cancel} />
{/if}

<style lang="postcss">
	@reference "../../../app.css";

	/*
	 * Every row keeps the corner clear for the owner's menu: the first line stops short of it, and
	 * the menu is placed over the row's padding, so its arrival changes no row's height.
	 */
	.line {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
		padding-right: 2rem;
	}

	.more {
		position: absolute;
		top: calc(var(--spacing-md) - 0.375rem);
		right: calc(20px - 0.5rem);
	}

	@media (pointer: coarse) {
		.line {
			padding-right: 2.75rem;
		}

		.more {
			top: var(--spacing-md);
			right: 0.5rem;
		}
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	.body {
		@apply text-base;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
