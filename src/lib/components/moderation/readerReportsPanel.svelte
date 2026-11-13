<script lang="ts">
	import CountFlagList from '#lib/components/moderation/countFlagList.svelte';
	import FlaggedTitleRow from '#lib/components/moderation/flaggedTitleRow.svelte';
	import HeldReportRow from '#lib/components/moderation/heldReportRow.svelte';
	import TitleReportRow from '#lib/components/moderation/titleReportRow.svelte';
	import type {
		ActionOutcome,
		FlaggedTitle,
		HeldReport,
		OpenTitle
	} from '#lib/media/types/moderation.ts';
	import { titleHref } from '#lib/media/utils/titleHref.ts';

	interface Props {
		held: HeldReport[];
		flagged: FlaggedTitle[];
		/** The title whose reports are open, from `?title=`. */
		openTitle: OpenTitle | null;
		outcome: ActionOutcome;
	}

	let { held, flagged, openTitle, outcome }: Props = $props();

	const openFlags = $derived(flagged.find((f) => f.titleId === openTitle?.id)?.flags ?? []);
	const openHref = $derived(openTitle ? titleHref(openTitle.kind, openTitle.tmdbId) : undefined);
</script>

{#if openTitle}
	<section class="group" aria-labelledby="open-title">
		<a class="back link" href="/user/moderation">Back to reader reports</a>
		<h2 id="open-title" class="heading">
			{#if openHref}<a class="link" href={openHref}>{openTitle.name}</a>{:else}{openTitle.name}{/if}
		</h2>
		{#if openFlags.length > 0}
			<div class="card flags">
				<h3 class="label">Counts look wrong</h3>
				<CountFlagList flags={openFlags} {outcome} />
			</div>
		{/if}
		{#if openTitle.reports.length === 0}
			<p class="empty" id="moderation-empty" tabindex="-1">This title has no reader reports.</p>
		{:else}
			<ul class="card list">
				{#each openTitle.reports as report (report.account.userId)}
					<TitleReportRow {report} titleId={openTitle.id} {outcome} />
				{/each}
			</ul>
		{/if}
	</section>
{:else}
	<section class="group" aria-labelledby="held-heading">
		<h2 id="held-heading" class="heading">Held</h2>
		{#if held.length === 0}
			<p class="empty" id="moderation-empty" tabindex="-1">No reader reports are waiting.</p>
		{:else}
			<ul class="card list">
				{#each held as report (`${report.account.userId}:${report.titleId}`)}
					<HeldReportRow {report} {outcome} />
				{/each}
			</ul>
		{/if}
	</section>
	<section class="group" aria-labelledby="flagged-heading">
		<h2 id="flagged-heading" class="heading">Flagged titles</h2>
		{#if flagged.length === 0}
			<p class="empty">No titles have open counts flags.</p>
		{:else}
			<ul class="card list">
				{#each flagged as entry (entry.titleId)}
					<FlaggedTitleRow flagged={entry} />
				{/each}
			</ul>
		{/if}
	</section>
{/if}

<style lang="postcss">
	@reference "../../../app.css";

	.group {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-lg);
	}

	.heading {
		@apply text-lg font-semibold;
	}

	.back {
		@apply text-sm;
	}

	.flags {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		padding: 16px 20px;
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
