<script lang="ts">
	import CountFlagItem from '#lib/components/moderation/countFlagItem.svelte';
	import type { FlaggedTitle } from '#lib/media/types/moderation.ts';

	interface Props {
		flags: FlaggedTitle['flags'];
	}

	let { flags }: Props = $props();
</script>

<ul class="flags">
	{#each flags as flag (flag.id)}
		<CountFlagItem {flag} />
	{/each}
</ul>

<style lang="postcss">
	@reference "../../../app.css";

	.flags {
		@apply flex flex-col list-none m-0 p-0;
		gap: var(--spacing-sm);
	}

	.flags > :global(li + li) {
		border-top: 1px solid var(--border);
		padding-top: var(--spacing-sm);
	}
</style>
