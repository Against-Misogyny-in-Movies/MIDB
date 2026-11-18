<script lang="ts">
	import type { Snippet } from 'svelte';
	import ResourceNav from './resourceNav.svelte';

	interface Props {
		items: { id: string; label: string }[];
		/** The width of the content column beside the list, as a CSS length. */
		columnWidth: string;
		/** Where the list moves beside the column: `md` is 48rem, `lg` is 56rem. */
		breakpoint: 'md' | 'lg';
		/** Centres the list and the column on the wide layout, and drops the list below it. */
		centered?: boolean;
		/** The content column: the one direct child that fills the grid's second cell. */
		children: Snippet;
	}

	let { items, columnWidth, breakpoint, centered = false, children }: Props = $props();
</script>

<div class="layout {breakpoint}" class:centered style:--column-width={columnWidth}>
	<aside class="nav-col">
		<ResourceNav {items} />
	</aside>
	{@render children()}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.layout {
		@apply grid gap-lg items-start;
		grid-template-columns: minmax(0, 1fr);
	}

	/* The "On this page" list needs the width beside the column; a centred page drops it below that. */
	.centered .nav-col {
		@apply hidden;
	}

	@media (min-width: 48rem) {
		.md {
			grid-template-columns: 12rem minmax(0, var(--column-width));
			gap: var(--spacing-xl);
		}

		.md.centered {
			justify-content: center;
		}

		/* The grid cell is only as tall as the list (items: start), so the cell itself pins. */
		.md .nav-col {
			@apply block sticky;
			top: 5rem;
		}
	}

	@media (min-width: 56rem) {
		.lg {
			grid-template-columns: 12rem minmax(0, var(--column-width));
			gap: var(--spacing-xl);
		}

		.lg.centered {
			justify-content: center;
		}

		.lg .nav-col {
			@apply block sticky;
			top: 5rem;
		}
	}
</style>
