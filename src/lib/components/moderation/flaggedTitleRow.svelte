<script lang="ts">
	import type { FlaggedTitle } from '#lib/media/types/moderation.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { titleHref } from '#lib/media/utils/titleHref.ts';

	interface Props {
		flagged: FlaggedTitle;
	}

	let { flagged }: Props = $props();

	const href = $derived(titleHref(flagged.title.kind, flagged.title.tmdbId));
</script>

<li class="item">
	<header class="meta">
		<span class="name">
			{#if href}<a class="link" {href}>{flagged.title.name}</a>{:else}{flagged.title.name}{/if}
		</span>
		<span class="label">
			{flagged.flags.length}
			{flagged.flags.length === 1 ? 'open flag' : 'open flags'}
		</span>
		<a class="link" href="?title={flagged.titleId}">Open reports</a>
	</header>
	<ul>
		{#each flagged.flags as flag (flag.id)}
			<li>
				<span class="label">{flag.reporter ?? 'A removed account'}</span>
				<time class="label" datetime={flag.createdAt}>{formatDate(flag.createdAt)}</time>
				{#if flag.note}<span class="note">{flag.note}</span>{/if}
			</li>
		{/each}
	</ul>
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

	ul {
		@apply flex flex-col list-none m-0 p-0;
		gap: var(--spacing-xs);
	}

	li li {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.note {
		overflow-wrap: anywhere;
	}
</style>
