<script lang="ts">
	import type { SourceIndexItem } from '$lib/media/utils/sourceIndex';

	interface Props {
		items: SourceIndexItem[];
	}

	let { items }: Props = $props();

	const ICON = {
		bechdel: { icon: 'ri-chat-3-fill', hue: 'var(--src-bechdel)' },
		um: { icon: 'ri-flag-2-fill', hue: 'var(--src-um)' },
		ddd: { icon: 'ri-alarm-warning-fill', hue: 'var(--src-ddd)' }
	} as const;
</script>

<!-- Fixed three columns (one row each on phones), so the DDD value streaming in replaces
     "Loading…" in place without moving anything. -->
<ul class="source-index" aria-label="Sources">
	{#each items as item (item.label)}
		{@const meta = ICON[item.source]}
		<li>
			<svelte:element this={item.href ? 'a' : 'span'} class="item" href={item.href ?? undefined}>
				<i class={meta.icon} style="--hue: {meta.hue}" aria-hidden="true"></i>
				<span class="text">
					<span class="name">{item.label}</span>
					<span class="value" class:value--empty={!item.hasData} aria-busy={item.busy || undefined}
						>{item.value}</span
					>
				</span>
			</svelte:element>
		</li>
	{/each}
</ul>

<style lang="postcss">
	@reference "../../../../app.css";

	.source-index {
		@apply grid list-none m-0 p-0;
		grid-template-columns: 1fr;
		gap: 12px;
	}

	@media (min-width: 560px) {
		.source-index {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.item {
		@apply flex items-center no-underline;
		gap: 10px;
	}

	i {
		@apply shrink-0;
		font-size: 1rem;
		color: var(--hue);
	}

	.text {
		@apply flex flex-col min-w-0;
	}

	.name {
		font-size: 0.75rem;
		line-height: 1.33;
		color: var(--ink-muted);
	}

	.value {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
		transition: color 0.15s ease;
	}

	.value--empty {
		font-weight: 400;
		color: var(--ink-muted);
	}

	a.item:hover .value {
		color: var(--brand);
	}

	@media (max-width: 559px) {
		.text {
			@apply flex-row flex-1 justify-between items-baseline gap-md;
		}

		.name {
			font-size: 0.875rem;
		}
	}
</style>
