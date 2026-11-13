<script lang="ts">
	import { enhance } from '$app/forms';
	import Notice from '#lib/components/ui/notice.svelte';
	import type { ActionOutcome, RecentAction } from '#lib/media/types/moderation.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { titleHref } from '#lib/media/utils/titleHref.ts';

	interface Props {
		entry: RecentAction;
		outcome: ActionOutcome;
	}

	let { entry, outcome }: Props = $props();

	let busy = $state(false);
	let root: HTMLElement | undefined = $state();

	const VERBS: Record<RecentAction['action'], string> = {
		approve: 'approved a comment',
		hide: 'hid a comment',
		reject: 'rejected a comment',
		restore: 'restored a comment',
		dismiss: 'dismissed the reports on a comment',
		mute: 'muted',
		ban: 'banned',
		approve_report: 'counted a reader report',
		reject_report: 'rejected a reader report',
		reject_account_reports: 'rejected every reader report of',
		resolve_count_flag: 'resolved a counts flag',
		dismiss_count_flag: 'dismissed a counts flag'
	};

	/** A hide or a reject can be undone while the comment is still in that state. */
	const restorable = $derived(
		entry.commentId !== null &&
			(entry.action === 'hide' || entry.action === 'reject') &&
			(entry.commentStatus === 'hidden' || entry.commentStatus === 'rejected')
	);
	const mine = $derived(outcome?.id === entry.commentId ? outcome : null);
	/** The author changed the text after this action, so the text below is not what was acted on. */
	const editedSince = $derived(
		entry.commentEditedAt !== null && entry.commentEditedAt > entry.createdAt
	);
	const href = $derived(entry.title ? titleHref(entry.title.kind, entry.title.tmdbId) : undefined);
	const muteLength = $derived(
		entry.muteHours === null
			? ''
			: entry.muteHours === 24
				? ' for 1 day'
				: ` for ${entry.muteHours / 24} days`
	);
</script>

<li class="entry" tabindex="-1" bind:this={root}>
	<p class="line">
		<span class="name">{entry.actor?.displayName ?? 'A removed account'}</span>
		{VERBS[entry.action]}{#if entry.targetUser}
			<span class="name">{entry.targetUser.displayName}</span>{/if}{muteLength}
		<time class="label" datetime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
	</p>
	{#if entry.title}
		<p class="label">
			On
			{#if href}<a class="link" {href}>{entry.title.name}</a>{:else}{entry.title.name}{/if}
		</p>
	{/if}
	{#if entry.commentBody}
		<p class="body">{entry.commentBody}</p>
	{/if}
	{#if editedSince}
		<p class="label">Edited since</p>
	{/if}
	{#if entry.reason}
		<p class="label">Reason: {entry.reason}</p>
	{/if}
	{#if restorable}
		<form
			method="POST"
			action="?/restore"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update();
					busy = false;
					await focusAfterUpdate(() => root);
				};
			}}
		>
			<input type="hidden" name="id" value={entry.commentId} />
			<button class="btn btn--ink" disabled={busy}>{busy ? 'Restoring…' : 'Restore comment'}</button
			>
		</form>
	{/if}
	{#if mine?.error}<Notice tone="error">{mine.error}</Notice>{/if}
</li>

<style lang="postcss">
	@reference "../../../app.css";

	.entry {
		@apply flex flex-col items-start;
		gap: var(--spacing-xs);
		padding: 14px 20px;
	}

	.line {
		@apply flex flex-wrap items-baseline text-sm;
		gap: var(--spacing-xs);
	}

	.name {
		@apply font-semibold;
	}

	.body {
		@apply line-clamp-2 text-sm text-ink-muted;
		overflow-wrap: anywhere;
	}
</style>
