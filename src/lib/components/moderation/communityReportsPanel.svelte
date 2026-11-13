<script lang="ts">
	import CountFlagList from '#lib/components/moderation/countFlagList.svelte';
	import FlaggedTitleRow from '#lib/components/moderation/flaggedTitleRow.svelte';
	import HeldReportRow from '#lib/components/moderation/heldReportRow.svelte';
	import TitleReportRow from '#lib/components/moderation/titleReportRow.svelte';
	import type { FlaggedTitle, HeldReport, OpenTitle } from '#lib/media/types/moderation.ts';
	import { canActOn } from '#lib/media/utils/canActOn.ts';
	import { titleHref } from '#lib/media/utils/titleHref.ts';

	interface Props {
		held: HeldReport[];
		flagged: FlaggedTitle[];
		/** The title whose reports are open, from `?title=`. */
		openTitle: OpenTitle | null;
		/** The id `?title=` named, which opens no title when none has it. */
		titleId?: string | null;
		/** The acting moderator, whose role decides which accounts the buttons offer. */
		me: { id: string; role: string };
	}

	let { held, flagged, openTitle, titleId = null, me }: Props = $props();

	const openFlags = $derived(flagged.find((f) => f.titleId === openTitle?.id)?.flags ?? []);
	const openHref = $derived(openTitle ? titleHref(openTitle.kind, openTitle.tmdbId) : undefined);
</script>

{#if openTitle}
	<section class="group" aria-labelledby="open-title">
		<a class="back" href="?tab=reports"
			><i class="ri-arrow-left-s-line" aria-hidden="true"></i>Back to community reports</a
		>
		<h2 id="open-title" class="heading" tabindex="-1">
			{#if openHref}<a class="link" href={openHref}>{openTitle.name}</a>{:else}{openTitle.name}{/if}
		</h2>
		{#if openFlags.length > 0}
			<div class="card flags">
				<h3 class="heading">Counts look wrong</h3>
				<CountFlagList flags={openFlags} />
			</div>
		{/if}
		{#if openTitle.reports.length === 0}
			<p class="empty" id="moderation-empty" tabindex="-1">This title has no community reports.</p>
		{:else}
			<ul class="card list">
				{#each openTitle.reports as report (report.account.userId)}
					<TitleReportRow
						{report}
						titleId={openTitle.id}
						canAct={canActOn(me, { id: report.account.userId, role: report.account.role })}
					/>
				{/each}
			</ul>
		{/if}
	</section>
{:else if titleId}
	<section class="group">
		<a class="back" href="?tab=reports"
			><i class="ri-arrow-left-s-line" aria-hidden="true"></i>Back to community reports</a
		>
		<p class="empty">That title has no community reports or no longer exists.</p>
	</section>
{:else}
	<section class="group" aria-labelledby="held-heading">
		<h2 id="held-heading" class="heading">Held</h2>
		{#if held.length === 0}
			<p class="empty" id="moderation-empty" tabindex="-1">No community reports are waiting.</p>
		{:else}
			<ul class="card list">
				{#each held as report (`${report.account.userId}:${report.titleId}`)}
					<HeldReportRow {report} />
				{/each}
			</ul>
		{/if}
	</section>
	<section class="group" aria-labelledby="flagged-heading">
		<h2 id="flagged-heading" class="heading">
			Flagged titles <span class="count">{flagged.length}</span>
		</h2>
		{#if flagged.length === 0}
			<p class="empty">No titles are marked Counts look wrong.</p>
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
		@apply inline-flex items-center self-start text-sm text-ink-muted no-underline;
	}

	.back:hover {
		@apply text-ink;
	}

	/* A touch target is 44px on a coarse pointer, like the buttons. */
	@media (pointer: coarse) {
		.back {
			min-height: 2.75rem;
		}
	}

	.count {
		@apply text-ink-muted font-normal;
		font-variant-numeric: tabular-nums;
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
