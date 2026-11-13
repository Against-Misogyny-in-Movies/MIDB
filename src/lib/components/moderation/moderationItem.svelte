<script lang="ts">
	import { enhance } from '$app/forms';
	import ModerationConfirm from '#lib/components/moderation/moderationConfirm.svelte';
	import Avatar from '#lib/components/user/avatars/Avatar.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import type { ModerationItem } from '#lib/media/types/moderation.ts';
	import { COMMENT_STATUS_LABELS, REPORT_REASON_LABELS } from '#lib/media/utils/comments.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';
	import { titleHref } from '#lib/media/utils/titleHref.ts';
	import { commentStatusTone } from '#lib/media/utils/tones.ts';

	interface Props {
		item: ModerationItem;
		/** False for an account this reader's role cannot mute or ban (an administrator, oneself, a moderator for a moderator). */
		canActOnAuthor: boolean;
	}

	let { item, canActOnAuthor }: Props = $props();

	type Panel = 'hide' | 'reject' | 'mute' | 'ban';
	let panel = $state<Panel | null>(null);
	/** The action whose form is in flight, so its button reads as busy and the others wait. */
	let busy = $state<string | null>(null);
	let root: HTMLElement | undefined = $state();

	const { comment, author } = $derived(item);
	const href = $derived(titleHref(item.title.kind, item.title.tmdbId));
	const SOURCES: Record<string, string> = {
		ai: 'Held by the automatic check',
		blocklist: 'Matched the blocklist',
		reports: 'Sent back by reports'
	};
	const heldBy = $derived(comment.moderationSource ? SOURCES[comment.moderationSource] : null);

	/**
	 * A form action. When the comment leaves the queue its row is gone, so the focus goes to the
	 * next row, the previous one, or the empty-state line; a row that stays takes it back.
	 */
	const submit = rowSubmit(
		() => root,
		(name) => (busy = name),
		() => (panel = null)
	);

	const toggle = (next: Panel) => (panel = panel === next ? null : next);
</script>

<li class="item" id="comment-{comment.id}" tabindex="-1" bind:this={root}>
	<header class="meta">
		<Avatar avatarKey={author.avatarKey} size={24} />
		<span class="name">{author.displayName}</span>
		{#if author.role !== 'user'}
			<Badge tone="brand">{author.role === 'moderator' ? 'Moderator' : 'Administrator'}</Badge>
		{/if}
		<span class="label">
			{item.authorCommentCount}
			{item.authorCommentCount === 1 ? 'comment' : 'comments'} in all
		</span>
		{#if item.authorMutedUntil}
			<span class="label">Muted until {formatDate(item.authorMutedUntil)}</span>
		{/if}
		<time class="label" datetime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
		{#if comment.editedAt}<span class="label">Edited</span>{/if}
		<Badge tone={commentStatusTone(comment.status)}>{COMMENT_STATUS_LABELS[comment.status]}</Badge>
		{#if heldBy}<span class="label">{heldBy}</span>{/if}
	</header>

	<p class="label">
		{comment.parentId ? 'Reply on' : 'On'}
		{#if href}<a class="link" {href}>{item.title.name}</a>{:else}{item.title.name}{/if}
	</p>
	<p class="body">{comment.body}</p>

	{#if item.aiCategories.length > 0}
		<ul class="tags" aria-label="Categories from the automatic check">
			{#each item.aiCategories as category (category)}
				<li><Badge tone="neutral">{category}</Badge></li>
			{/each}
		</ul>
	{/if}

	{#if item.reports.length > 0}
		<section class="reports" aria-label="Open reports">
			<p class="label">
				{item.reports.length}
				{item.reports.length === 1 ? 'open report' : 'open reports'}
			</p>
			<ul>
				{#each item.reports as report (report.createdAt + report.reason)}
					<li>
						<Badge tone="neutral">{REPORT_REASON_LABELS[report.reason]}</Badge>
						{#if report.note}<span class="note">{report.note}</span>{/if}
						<time class="label" datetime={report.createdAt}>{formatDate(report.createdAt)}</time>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="actions">
		{#if comment.status === 'pending'}
			<form method="POST" action="?/approve" use:enhance={submit('approve')}>
				<input type="hidden" name="id" value={comment.id} />
				<button
					class="btn btn--ink"
					aria-busy={busy === 'approve'}
					disabled={busy !== null && busy !== 'approve'}
				>
					Approve
				</button>
			</form>
		{/if}
		{#if item.reports.length > 0}
			<form method="POST" action="?/dismiss" use:enhance={submit('dismiss')}>
				<input type="hidden" name="id" value={comment.id} />
				<button
					class="btn btn--ink"
					aria-busy={busy === 'dismiss'}
					disabled={busy !== null && busy !== 'dismiss'}
				>
					Dismiss reports
				</button>
			</form>
		{/if}
		<button
			class="btn btn--ghost"
			type="button"
			aria-expanded={panel === 'hide'}
			onclick={() => toggle('hide')}>Hide</button
		>
		<button
			class="btn btn--ghost"
			type="button"
			aria-expanded={panel === 'reject'}
			onclick={() => toggle('reject')}>Reject</button
		>
		{#if canActOnAuthor}
			{#if !item.authorMutedUntil}
				<button
					class="btn btn--ghost"
					type="button"
					aria-expanded={panel === 'mute'}
					onclick={() => toggle('mute')}>Mute author</button
				>
			{/if}
			<button
				class="btn btn--ghost"
				type="button"
				aria-expanded={panel === 'ban'}
				onclick={() => toggle('ban')}>Ban author</button
			>
		{/if}
	</div>

	{#if panel}
		<ModerationConfirm
			kind={panel}
			name={author.displayName}
			fields={{ id: comment.id, userId: author.id }}
			{busy}
			{submit}
			oncancel={() => (panel = null)}
		/>
	{/if}
</li>

<style lang="postcss">
	@reference "../../../app.css";

	.item {
		@apply flex flex-col;
		gap: var(--spacing-xs);
		padding: 16px 20px;
	}

	.meta {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.name {
		@apply font-semibold;
	}

	.body {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.tags,
	.reports ul {
		@apply flex flex-wrap list-none m-0 p-0;
		gap: var(--spacing-xs);
	}

	.reports {
		@apply flex flex-col;
		gap: var(--spacing-xs);
	}

	.reports ul {
		@apply flex-col;
	}

	.reports li {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.note {
		overflow-wrap: anywhere;
	}

	.actions {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-xs);
	}
</style>
