<script lang="ts">
	import ModerationItemRow from '#lib/components/moderation/moderationItem.svelte';
	import RecentActionRow from '#lib/components/moderation/recentActionRow.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import type { ActionOutcome } from '#lib/media/types/moderation.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { STALE_SYNC_HOURS } from '#lib/media/utils/staleSync.ts';

	let { data, form } = $props();

	type Tab = 'pending' | 'reported' | 'recent';
	let tab = $state<Tab>('pending');

	const TABS = $derived([
		{ id: 'pending' as const, label: 'Pending', count: data.pending.length },
		{ id: 'reported' as const, label: 'Reported', count: data.reported.length },
		{ id: 'recent' as const, label: 'Recent actions', count: null }
	]);

	const outcome = $derived((form ?? null) as ActionOutcome);
	const items = $derived(tab === 'reported' ? data.reported : data.pending);

	/** An administrator acts on moderators too; nobody acts on an administrator or on themselves. */
	const canActOn = (author: { id: string; role: string }) =>
		author.id !== data.me.id &&
		author.role !== 'administrator' &&
		(author.role !== 'moderator' || data.me.role === 'administrator');
</script>

<svelte:head>
	<title>Moderation · MIDB</title>
</svelte:head>

<div class="page">
	<header>
		<a href="/user/profile" class="back"
			><i class="ri-arrow-left-s-line" aria-hidden="true"></i>Profile</a
		>
		<h1 class="display">Moderation</h1>
	</header>

	{#if data.staleSources.length > 0}
		<Notice tone="warn">
			No successful source sync for more than {STALE_SYNC_HOURS} hours: titles may show out-of-date data.
			Last success:
			{#each data.staleSources as source, i (source.source)}
				{source.label}, {formatDate(source.lastSuccessAt)}{i < data.staleSources.length - 1
					? '; '
					: '.'}
			{/each}
		</Notice>
	{/if}

	<div class="tabs" role="tablist" aria-label="Moderation queues">
		{#each TABS as t (t.id)}
			<button
				class="chip"
				type="button"
				role="tab"
				id="tab-{t.id}"
				aria-selected={tab === t.id}
				aria-controls="panel-{t.id}"
				onclick={() => (tab = t.id)}
			>
				{t.label}{#if t.count !== null}
					<span class="count">{t.count}</span>{/if}
			</button>
		{/each}
	</div>

	<div id="panel-{tab}" role="tabpanel" aria-labelledby="tab-{tab}">
		{#if tab === 'recent'}
			{#if data.recent.length === 0}
				<p class="empty">No moderation actions yet.</p>
			{:else}
				<ul class="card list">
					{#each data.recent as entry (entry.id)}
						<RecentActionRow {entry} {outcome} />
					{/each}
				</ul>
			{/if}
		{:else if items.length === 0}
			<p class="empty">
				{tab === 'pending'
					? 'No comments are waiting for review.'
					: 'No comments have open reports.'}
			</p>
		{:else}
			<ul class="card list">
				{#each items as item (item.comment.id)}
					<ModerationItemRow {item} {outcome} canActOnAuthor={canActOn(item.author)} />
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.page {
		@apply flex flex-col mx-auto;
		max-width: 48rem;
		gap: var(--spacing-md);
		padding-block: var(--spacing-xl);
	}

	.back {
		@apply inline-flex items-center text-sm text-ink-muted no-underline;
		margin-bottom: var(--spacing-sm);
	}

	.back:hover {
		@apply text-ink;
	}

	h1 {
		font-size: 1.875rem;
	}

	.tabs {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}

	/* A touch target is 44px on a coarse pointer, like the buttons. */
	@media (pointer: coarse) {
		.chip {
			height: 2.75rem;
		}
	}

	.chip[aria-selected='true'] {
		border-color: var(--brand);
		color: var(--brand);
	}

	.count {
		font-variant-numeric: tabular-nums;
	}

	.empty {
		@apply text-ink-muted;
	}

	.list {
		@apply flex flex-col list-none p-0 m-0 overflow-hidden;
	}

	.list > :global(li + li) {
		border-top: 1px solid var(--border);
	}
</style>
