<script lang="ts">
	import { goto } from '$app/navigation';
	import ModerationItemRow from '#lib/components/moderation/moderationItem.svelte';
	import CommunityReportsPanel from '#lib/components/moderation/communityReportsPanel.svelte';
	import PagedList from '#lib/components/moderation/pagedList.svelte';
	import RecentActionRow from '#lib/components/moderation/recentActionRow.svelte';
	import TablePanel from '#lib/components/moderation/table/tablePanel.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { STALE_SYNC_HOURS } from '#lib/media/utils/staleSync.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { tabHref, type ModerationTab } from '#lib/media/utils/moderationTabs.ts';

	let { data } = $props();

	/** The URL is the one source of the open tab: the load parses `?tab=` and `?title=`. */
	const tab = $derived(data.tab);

	/**
	 * Each count is a total from the database, not the length of the page shown: Pending is the
	 * comments awaiting a decision, Reported those with an open report, and the community reports
	 * tab the held reports plus the titles with open flags.
	 */
	const TABS = $derived([
		{ id: 'pending' as const, label: 'Pending', count: data.counts.pending },
		{ id: 'reported' as const, label: 'Reported', count: data.counts.reported },
		{ id: 'table' as const, label: 'All comments', count: null },
		{
			id: 'reports' as const,
			label: 'MIDB community reports',
			count: data.counts.held + data.counts.flagged
		},
		{ id: 'log' as const, label: 'Recent actions', count: null }
	]);

	/**
	 * Choosing a tab goes to its URL, which the load reads. The tab buttons stay mounted, so the
	 * focus stays on the chosen one and the page keeps its scroll position (`reset: false`).
	 */
	function select(next: ModerationTab) {
		if (next !== tab || data.titleId) {
			void goto(tabHref(next), { reset: false });
		}
	}

	/**
	 * The tab keyboard pattern: one tab is in the tab order, the arrow keys move between tabs
	 * (wrapping), Home and End go to the ends, and the focused tab is the selected one.
	 */
	function onTabKeydown(event: KeyboardEvent, index: number) {
		const last = TABS.length - 1;
		const target =
			event.key === 'ArrowRight'
				? index === last
					? 0
					: index + 1
				: event.key === 'ArrowLeft'
					? index === 0
						? last
						: index - 1
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? last
							: null;
		if (target === null) return;
		event.preventDefault();
		select(TABS[target].id);
		void focusAfterUpdate(() => document.getElementById(`tab-${TABS[target].id}`));
	}
</script>

<svelte:head>
	<title>Moderation · MIDB</title>
</svelte:head>

<div class="page" class:wide={tab === 'table'}>
	<header>
		<a href="/user/profile" class="back"
			><i class="ri-arrow-left-s-line" aria-hidden="true"></i>Profile</a
		>
		<h1 class="display">Moderation</h1>
	</header>

	{#if data.staleSources.length > 0}
		<Notice tone="warn">
			These sources have had no successful sync for {STALE_SYNC_HOURS} hours or more, so title pages may
			show out-of-date data. Last success:
			{#each data.staleSources as source, i (source.source)}
				{source.label}, {formatDate(source.lastSuccessAt)}{i < data.staleSources.length - 1
					? '; '
					: '.'}
			{/each}
		</Notice>
	{/if}

	<div class="tabs" role="tablist" aria-label="Moderation queues">
		{#each TABS as t, i (t.id)}
			<button
				class="chip"
				type="button"
				role="tab"
				id="tab-{t.id}"
				aria-selected={tab === t.id}
				aria-controls={tab === t.id ? `panel-${t.id}` : undefined}
				tabindex={tab === t.id ? 0 : -1}
				onclick={() => select(t.id)}
				onkeydown={(event) => onTabKeydown(event, i)}
			>
				{t.label}{#if t.count !== null}
					<span class="count">{t.count}</span>{/if}
			</button>
		{/each}
	</div>

	<div id="panel-{tab}" role="tabpanel" aria-labelledby="tab-{tab}">
		{#if tab === 'table'}
			{#if data.table && data.filters}
				<TablePanel
					table={data.table}
					filters={data.filters}
					aiAvailable={data.aiAvailable}
					me={data.me}
				/>
			{:else}
				<div class="card skeleton" aria-busy="true" aria-label="Loading comments">
					{#each [0, 1, 2, 3, 4, 5] as row (row)}
						<div class="skeleton-row"></div>
					{/each}
				</div>
			{/if}
		{:else if tab === 'log' && data.recent}
			<PagedList
				page={data.recent}
				queue="log"
				key={(entry) => entry.id}
				empty="No moderation actions yet."
				noun="actions"
			>
				{#snippet row(entry)}
					<RecentActionRow {entry} />
				{/snippet}
			</PagedList>
		{:else if tab === 'reports'}
			<CommunityReportsPanel
				held={data.held}
				flagged={data.flagged}
				flaggedCount={data.counts.flagged}
				openTitle={data.openTitle}
				titleId={data.titleId}
				me={data.me}
			/>
		{:else if tab === 'pending' && data.pending}
			<PagedList
				page={data.pending}
				queue="pending"
				key={(item) => item.comment.id}
				empty="No comments are waiting for review."
				noun="comments"
			>
				{#snippet row(item)}
					<ModerationItemRow {item} me={data.me} />
				{/snippet}
			</PagedList>
		{:else if tab === 'reported' && data.reported}
			<PagedList
				page={data.reported}
				queue="reported"
				key={(item) => item.comment.id}
				empty="No comments have open reports."
				noun="comments"
			>
				{#snippet row(item)}
					<ModerationItemRow {item} me={data.me} />
				{/snippet}
			</PagedList>
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

	/*
	 * The table needs more room than the layout's column: on a wide screen the page grows past the
	 * column on both sides, up to 90rem, and keeps a 1.5rem margin to the window's edges.
	 */
	.page.wide {
		max-width: none;
	}

	@media (min-width: 64rem) {
		.page.wide {
			width: min(90rem, 100vw - 3rem);
			margin-left: calc(50% - min(45rem, 50vw - 1.5rem));
		}
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

	/* Room for the filters and the first rows, so the table replaces it without moving what is below. */
	.skeleton {
		@apply flex flex-col;
		min-height: 18rem;
	}

	.skeleton-row {
		@apply flex items-center border-b border-border;
		height: 3rem;
		animation: pulse 1.6s ease-in-out infinite;
	}

	.skeleton-row::before {
		content: '';
		width: 40%;
		height: 0.75rem;
		margin-left: var(--spacing-md);
		background-color: var(--surface-sunken);
	}

	@keyframes pulse {
		50% {
			opacity: 0.5;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.skeleton-row {
			animation: none;
		}
	}
</style>
