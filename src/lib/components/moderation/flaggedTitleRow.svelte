<script lang="ts">
	import ReportRowShell from '#lib/components/moderation/reportRowShell.svelte';
	import type { FlaggedTitle } from '#lib/media/types/moderation.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { titleHref } from '#lib/media/utils/titleHref.ts';

	interface Props {
		flagged: FlaggedTitle;
	}

	let { flagged }: Props = $props();

	const href = $derived(titleHref(flagged.title.kind, flagged.title.tmdbId));
</script>

<ReportRowShell>
	{#snippet name()}
		{#if href}<a class="link" {href}>{flagged.title.name}</a>{:else}{flagged.title.name}{/if}
	{/snippet}
	{#snippet meta()}
		<span class="label">Counts look wrong: {flagged.flags.length} open</span>
	{/snippet}
	<ul>
		{#each flagged.flags as flag (flag.id)}
			<li>
				<span class="label">{flag.reporter ?? 'An account'}</span>
				<time class="label" datetime={flag.createdAt}>{formatDate(flag.createdAt)}</time>
				{#if flag.note}<span class="note">{flag.note}</span>{/if}
			</li>
		{/each}
	</ul>
	{#snippet actions()}
		<a class="btn btn--ink" href="?title={flagged.titleId}">See reader reports</a>
	{/snippet}
</ReportRowShell>

<style lang="postcss">
	@reference "../../../app.css";

	ul {
		@apply flex flex-col list-none m-0 p-0;
		gap: var(--spacing-xs);
	}

	li {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.note {
		overflow-wrap: anywhere;
	}
</style>
