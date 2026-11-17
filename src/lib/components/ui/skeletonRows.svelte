<script lang="ts">
	interface Props {
		/** How many rows the loaded list will have. */
		rows: number;
		/** The screen-reader text announced while the rows wait. */
		label: string;
		/** A row's height, as a CSS length, so the loaded row takes its place without a shift. */
		height?: string;
		/** The first row's height when it differs from the others, as a CSS length. */
		firstHeight?: string;
	}

	let { rows, label, height = '2.375rem', firstHeight }: Props = $props();
</script>

<div
	class="skeleton"
	role="status"
	style:--skeleton-row-height={height}
	style:--skeleton-first-height={firstHeight ?? height}
>
	<span class="sr-only">{label}</span>
	{#each { length: rows } as _, i (i)}
		<div class="skeleton-row"></div>
	{/each}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.skeleton {
		@apply flex flex-col;
	}

	/* The hairline sits between rows only, as in the loaded list; it adds to a row's height, as a loaded row's does. */
	.skeleton-row {
		@apply relative;
		box-sizing: content-box;
		height: var(--skeleton-row-height);
		animation: pulse 1.6s ease-in-out infinite;
	}

	.skeleton-row:first-of-type {
		height: var(--skeleton-first-height);
	}

	.skeleton-row + .skeleton-row {
		border-top: 1px solid var(--border);
	}

	.skeleton-row::before {
		content: '';
		@apply absolute;
		inset-block: 0;
		inset-inline-start: 0;
		width: 40%;
		height: 0.75rem;
		margin-block: auto;
		border-radius: 9999px;
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
