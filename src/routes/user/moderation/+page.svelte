<script lang="ts">
	import { goto } from '$app/navigation';
	import ModerationItemRow from '#lib/components/moderation/moderationItem.svelte';
	import CommunityReportsPanel from '#lib/components/moderation/communityReportsPanel.svelte';
	import RecentActionRow from '#lib/components/moderation/recentActionRow.svelte';
	import TablePanel from '#lib/components/moderation/table/tablePanel.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import { canActOn } from '#lib/media/utils/canActOn.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { STALE_SYNC_HOURS } from '#lib/media/utils/staleSync.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';

	let { data } = $props();

	type Tab = 'pending' | 'reported' | 'reports' | 'recent' | 'table';
	/**
	 * `?tab=reports` and `?title=` open the community-reports tab, `?tab=table` the table of every
	 * comment, every other URL opens Pending. A click on a tab overrides it until the URL changes
	 * (a title's reports, back to the list).
	 */
	let tab = $derived<Tab>(
		data.titleId || data.tab === 'reports' ? 'reports' : data.tab === 'table' ? 'table' : 'pending'
	);

	const TABS = $derived([
		{ id: 'pending' as const, label: 'Pending', count: data.pending.length },
		{ id: 'reported' as const, label: 'Reported', count: data.reported.length },
		{ id: 'table' as const, label: 'All comments', count: null },
		{
			id: 'reports' as const,
			label: 'MIDB community reports',
			count: data.held.length
		},
		{ id: 'recent' as const, label: 'Recent actions', count: null }
	]);

	/**
	 * The table loads from the server with its filters, so choosing it goes to its URL. Leaving it
	 * drops `tab=table` from the URL: a later action's `update()` reloads the page from the URL, and
	 * a URL that still named the table would bring it back and run its query again. The navigation
	 * keeps the focus (`reset: false`), and the chosen tab is set again once it is done, because the
	 * new data derives Pending or the reports tab from the URL.
	 */
	async function select(next: Tab) {
		tab = next;
		if (next === 'table') {
			if (data.tab !== 'table') void goto('?tab=table', { reset: false });
		} else if (data.tab === 'table') {
			await goto(next === 'reports' ? '?tab=reports' : '?', { reset: false });
			tab = next;
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
		void select(TABS[target].id);
		void focusAfterUpdate(() => document.getElementById(`tab-${TABS[target].id}`));
	}

	const items = $derived(tab === 'reported' ? data.reported : data.pending);
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
				onclick={() => void select(t.id)}
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
		{:else if tab === 'recent'}
			{#if data.recent.length === 0}
				<p class="empty" id="moderation-empty" tabindex="-1">No moderation actions yet.</p>
			{:else}
				<ul class="card list">
					{#each data.recent as entry (entry.id)}
						<RecentActionRow {entry} />
					{/each}
				</ul>
			{/if}
		{:else if tab === 'reports'}
			<CommunityReportsPanel
				held={data.held}
				flagged={data.flagged}
				openTitle={data.openTitle}
				titleId={data.titleId}
				me={data.me}
			/>
		{:else if items.length === 0}
			<p class="empty" id="moderation-empty" tabindex="-1">
				{tab === 'pending'
					? 'No comments are waiting for review.'
					: 'No comments have open reports.'}
			</p>
		{:else}
			<ul class="card list">
				{#each items as item (item.comment.id)}
					<ModerationItemRow {item} canActOnAuthor={canActOn(data.me, item.author)} />
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

	/* The table takes the layout's whole column; the header and the tabs keep its left edge. */
	.page.wide {
		max-width: none;
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
