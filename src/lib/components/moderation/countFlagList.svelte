<script lang="ts">
	import CountFlagItem from '#lib/components/moderation/countFlagItem.svelte';
	import type { FlaggedTitle } from '#lib/media/types/moderation.ts';
	import { canCloseFlag } from '#lib/media/utils/canActOn.ts';

	interface Props {
		flags: FlaggedTitle['flags'];
		/** The acting staff member, whose role decides which flags the buttons offer (a moderator gets none of their own or an administrator's). */
		me: { id: string; role: string };
	}

	let { flags, me }: Props = $props();
</script>

<ul class="flags">
	{#each flags as flag (flag.id)}
		<CountFlagItem
			{flag}
			canAct={canCloseFlag(me, { id: flag.reporterId, role: flag.reporterRole })}
		/>
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
