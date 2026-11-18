<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import CommunityReportsPanel from '#lib/components/moderation/communityReportsPanel.svelte';
	import LogFilters from '#lib/components/moderation/logFilters.svelte';
	import PagedList from '#lib/components/moderation/pagedList.svelte';
	import ModerationSettings from '#lib/components/moderation/moderationSettings.svelte';
	import ShortcutList from '#lib/components/moderation/shortcutList.svelte';
	import QueueView from '#lib/components/moderation/queue/queueView.svelte';
	import RecentActionRow from '#lib/components/moderation/recentActionRow.svelte';
	import TablePanel from '#lib/components/moderation/table/tablePanel.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import SkeletonRows from '#lib/components/ui/skeletonRows.svelte';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { STALE_SYNC_HOURS } from '#lib/media/utils/staleSync.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { shortcutOf } from '#lib/media/utils/moderationKeys.ts';
	import { moderationPrefs } from '#lib/media/utils/moderationPrefs.svelte.js';
	import { moderationStatus } from '#lib/media/utils/moderationStatus.svelte.js';
	import { tabHref, type ModerationTab } from '#lib/media/utils/moderationTabs.ts';

	let { data } = $props();

	onMount(() => {
		moderationPrefs.start();
		moderationStatus.left = remaining;
		return () => {
			moderationStatus.left = null;
		};
	});

	/** The URL is the one source of the open tab: the load parses `?tab=` and `?title=`. */
	const tab = $derived(data.tab);
	const queueTab = $derived(tab === 'pending' || tab === 'reported');
	/** The tabs the keyboard shortcuts work on. */
	const keyTab = $derived(queueTab || tab === 'table');

	/** The shortcut list: `?` or its button opens it, Escape or Close closes it and gives the focus back. */
	let helpOpen = $state(false);
	let helpButton: HTMLButtonElement | undefined = $state();
	let helpFrom: HTMLElement | null = null;

	function toggleHelp() {
		if (helpOpen) return closeHelp();
		const active = document.activeElement;
		// A click does not focus the button in every browser; the opening button is the fallback.
		helpFrom = active instanceof HTMLElement && active !== document.body ? active : null;
		helpOpen = true;
	}

	function closeHelp() {
		helpOpen = false;
		void focusAfterUpdate(() => (helpFrom?.isConnected ? helpFrom : helpButton));
	}

	function onkeydown(event: KeyboardEvent) {
		if (helpOpen && event.key === 'Escape' && !event.defaultPrevented) return closeHelp();
		if (keyTab && shortcutOf(event, moderationPrefs.shortcuts) === 'help') {
			event.preventDefault();
			toggleHelp();
		}
	}

	/** The last action's result belongs to the tab it ran in. */
	let shownTab: ModerationTab | undefined;
	$effect(() => {
		if (shownTab !== undefined && shownTab !== tab) moderationStatus.clear();
		shownTab = tab;
	});

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
		{ id: 'log' as const, label: 'Log', count: null }
	]);

	/** What an empty log says: no account behind a name typed into a filter, a filter that matches nothing, or an empty log. */
	const logEmpty = $derived.by(() => {
		const unknown = data.unknownNames;
		const f = data.logFilters;
		if (f && unknown.length > 0) {
			return `No account is named ${unknown.map((k) => (k === 'actor' ? f.actor : f.account)).join(' or ')}.`;
		}
		return f && (f.action || f.actor || f.account)
			? 'No moderation actions match these filters.'
			: 'No moderation actions yet.';
	});

	/** "41 left in Pending.": what remains in the open queue, from the load's totals; empty on the other tabs. */
	function remaining(): string {
		if (tab !== 'pending' && tab !== 'reported') return '';
		const left = data.counts[tab];
		return `${left === 0 ? 'Nothing' : left} left in ${tab === 'pending' ? 'Pending' : 'Reported'}.`;
	}

	/** "Hidden. 41 left in Pending.": the result of the last action and the count. The toast announces it, so the line is for the eye. */
	const status = $derived(
		moderationStatus.label && remaining() ? `${moderationStatus.label}. ${remaining()}` : ''
	);

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

<svelte:window {onkeydown} />

<svelte:head>
	<title>Moderation · MIDB</title>
</svelte:head>

<div class="page" class:wide={tab === 'table' || queueTab}>
	<header>
		<a href="/user/profile" class="back"
			><i class="ri-arrow-left-s-line" aria-hidden="true"></i>Profile</a
		>
		<h1 class="display">Moderation</h1>
		{#if data.me.role === 'administrator'}
			<a class="chip staff-link" href="/user/moderation/staff">Staff roles</a>
		{/if}
		{#if keyTab}
			<ModerationSettings {helpOpen} ontogglehelp={toggleHelp} bind:helpButton />
		{/if}
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

	{#if queueTab}
		<p class="status" aria-hidden="true">{status}</p>
	{/if}

	{#if helpOpen && keyTab}
		<ShortcutList onclose={closeHelp} />
	{/if}

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
				<div class="card skeleton" aria-busy="true">
					<SkeletonRows rows={6} label="Loading comments" height="3rem" />
				</div>
			{/if}
		{:else if tab === 'log' && data.recent && data.logFilters}
			<div class="stack">
				<LogFilters filters={data.logFilters} />
				<PagedList
					page={data.recent}
					queue="log"
					params={data.logParams}
					key={(entry) => entry.id}
					empty={logEmpty}
					noun="actions"
				>
					{#snippet row(entry)}
						<RecentActionRow {entry} me={data.me} />
					{/snippet}
				</PagedList>
			</div>
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
			<QueueView
				page={data.pending}
				queue="pending"
				me={data.me}
				empty="No comments are waiting for review."
			/>
		{:else if tab === 'reported' && data.reported}
			<QueueView
				page={data.reported}
				queue="reported"
				me={data.me}
				empty="No comments have open reports."
			/>
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

	/* One line for the last action's result, reserved so the first one moves nothing. */
	.status {
		@apply text-sm text-ink-muted;
		min-height: 1.25rem;
		margin-block: calc(-1 * var(--spacing-xs));
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

	.staff-link {
		@apply self-start;
	}

	header {
		@apply flex flex-col;
		gap: var(--spacing-xs);
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

	/* The selected tab also takes the heavier weight and the wash, so colour is not the only mark. */
	.chip[aria-selected='true'] {
		border-color: var(--brand);
		background-color: var(--brand-wash);
		color: var(--brand);
		font-weight: 600;
	}

	.stack {
		@apply flex flex-col;
		gap: var(--spacing-md);
	}

	.count {
		font-variant-numeric: tabular-nums;
	}

	/* Room for the filters and the first rows, so the table replaces it without moving what is below. */
	.skeleton {
		min-height: 18rem;
	}
</style>
