<script lang="ts">
	import { onMount } from 'svelte';
	import SettingsCard from '#lib/components/user/settingsCard.svelte';
	import { THEME_CHOICES, theme, type ThemeChoice } from '#lib/media/utils/theme.svelte.js';

	const OPTIONS: Record<ThemeChoice, { label: string; icon: string }> = {
		system: { label: 'System', icon: 'ri-computer-line' },
		light: { label: 'Light', icon: 'ri-sun-line' },
		dark: { label: 'Dark', icon: 'ri-moon-line' }
	};

	// The stored choice is only known in the browser. Until then the control shows the choice
	// from `data-theme` (set before first paint), through the styles below, so it never flashes.
	onMount(() => theme.start());
</script>

<SettingsCard id="appearance" headingId="appearance-heading" title="Appearance">
	<fieldset>
		<legend class="label">Theme</legend>
		<div class="options">
			{#each THEME_CHOICES as choice (choice)}
				<label class="chip option" data-choice={choice}>
					<input
						type="radio"
						name="theme"
						value={choice}
						checked={theme.choice === choice}
						onchange={() => theme.set(choice)}
					/>
					<i class={OPTIONS[choice].icon} aria-hidden="true"></i>
					{OPTIONS[choice].label}
				</label>
			{/each}
		</div>
	</fieldset>
	<p class="label">Saved in this browser. System follows the device's setting.</p>
</SettingsCard>

<style lang="postcss">
	@reference "../../../app.css";

	fieldset {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}

	legend {
		padding: 0;
		margin-bottom: var(--spacing-sm);
	}

	.options {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}

	.option {
		@apply relative;
	}

	/* The radio covers its chip: the whole chip is the target, and the arrow keys move between chips. */
	.option input {
		@apply absolute m-0 cursor-pointer;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
	}

	.option input:focus-visible {
		outline: none;
	}

	.option:has(input:focus-visible) {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}

	/* The selected chip follows the root's `data-theme`, which the pre-paint script sets before first
	   paint and `theme` keeps in step, so the right chip is selected before the script of the page
	   runs. No `data-theme` is System. */
	:global(:root:not([data-theme])) .option[data-choice='system'],
	:global(:root[data-theme='light']) .option[data-choice='light'],
	:global(:root[data-theme='dark']) .option[data-choice='dark'] {
		border-color: var(--brand);
		color: var(--brand);
	}
</style>
