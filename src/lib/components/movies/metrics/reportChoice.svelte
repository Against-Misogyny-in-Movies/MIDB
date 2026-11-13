<script lang="ts" generics="T extends string">
	interface Props {
		legend: string;
		/** Names the radio group; unique within the page. */
		name: string;
		options: readonly (readonly [T, string])[];
		value: T;
		/** A one-line description under the legend. */
		description?: string;
		/** A group in a list of rows: the legend reads as body text and the options sit beside it. */
		compact?: boolean;
	}

	let {
		legend,
		name,
		options,
		value = $bindable(),
		description,
		compact = false
	}: Props = $props();

	const descriptionId = $derived(description ? `${name}-description` : undefined);
</script>

<fieldset class="choice" class:choice--compact={compact} aria-describedby={descriptionId}>
	<legend class:label={!compact}>{legend}</legend>
	{#if description}
		<p id={descriptionId} class="label description">{description}</p>
	{/if}
	<div class="options">
		{#each options as [optionValue, label] (optionValue)}
			<label class="option">
				<input type="radio" {name} value={optionValue} bind:group={value} />
				{label}
			</label>
		{/each}
	</div>
</fieldset>

<style lang="postcss">
	@reference "../../../../app.css";

	.choice {
		@apply flex flex-col;
		gap: var(--spacing-xs);
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}

	legend {
		@apply text-sm font-semibold text-ink;
		padding: 0;
	}

	legend.label {
		@apply font-semibold text-ink;
	}

	.choice--compact legend {
		@apply font-normal;
	}

	.description {
		margin: 0;
	}

	.options {
		@apply flex flex-wrap;
		gap: var(--spacing-xs) var(--spacing-md);
	}

	.option {
		@apply inline-flex items-center gap-xs text-sm cursor-pointer;
		min-height: 1.75rem;
	}

	.option input {
		accent-color: var(--brand);
	}

	@media (pointer: coarse) {
		.option {
			min-height: 2.75rem;
		}
	}
</style>
