<script lang="ts">
	import type { Snippet } from 'svelte';
	import SettingsPlate from '#lib/components/user/settingsPlate.svelte';

	interface Props {
		/** A Remixicon class. */
		icon: string;
		name: string;
		/** The one muted line under the name; it clips on a narrow row. */
		detail: string;
		/** Sits after the name, such as a `Badge`. */
		badge?: Snippet;
		/** The row's buttons. An empty slot takes no line, so a row without actions is one line at every width. */
		actions?: Snippet;
		/** The confirmation or form that opens under the row, in a `--surface-sunken` plate. */
		plate?: Snippet;
		/** Whether the plate is open. */
		plateOpen?: boolean;
	}

	let { icon, name, detail, badge, actions, plate, plateOpen = false }: Props = $props();
</script>

<li>
	<div class="row">
		<i class="{icon} icon" aria-hidden="true"></i>
		<div class="meta">
			<span class="name-line">
				<span class="name">{name}</span>
				{@render badge?.()}
			</span>
			<span class="label detail">{detail}</span>
		</div>
		<div class="row-actions">
			{@render actions?.()}
		</div>
	</div>
	{#if plate && plateOpen}
		<div class="plate-slot">
			<SettingsPlate>
				{@render plate()}
			</SettingsPlate>
		</div>
	{/if}
</li>

<style lang="postcss">
	@reference "../../../app.css";

	.row {
		@apply grid items-center;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--spacing-sm);
		padding-block: var(--spacing-sm);
	}

	@media (min-width: 30rem) {
		.row {
			grid-template-columns: auto minmax(0, 1fr) auto;
		}
	}

	.icon {
		@apply text-xl text-ink-muted;
	}

	.meta {
		@apply flex flex-col justify-center min-w-0;
		height: 2.75rem;
	}

	.name-line {
		@apply flex items-center min-w-0;
		gap: var(--spacing-sm);
		height: 1.5rem;
	}

	.name {
		@apply font-medium truncate min-w-0;
		line-height: 1.5rem;
	}

	.name-line > :global(*:not(.name)) {
		@apply shrink-0;
	}

	/* One line that the date leads, so a narrow row clips what follows it and never the date. */
	.detail {
		@apply truncate;
		line-height: 1.25rem;
	}

	.row-actions {
		@apply flex items-center gap-sm;
		grid-column: 1 / -1;
		min-height: 2.75rem;
	}

	.row-actions:empty {
		display: none;
	}

	@media (min-width: 30rem) {
		.row-actions {
			grid-column: auto;
		}
	}

	.plate-slot {
		margin-bottom: var(--spacing-sm);
	}
</style>
