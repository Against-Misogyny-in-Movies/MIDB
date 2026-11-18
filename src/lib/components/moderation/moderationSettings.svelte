<script lang="ts">
	import { REJECT_MIN_SEVERITY } from '#lib/media/utils/comments.ts';
	import { moderationPrefs } from '#lib/media/utils/moderationPrefs.svelte.js';

	interface Props {
		/** Whether the shortcut list is open. */
		helpOpen: boolean;
		ontogglehelp: () => void;
		/** The button that opens the list, so the page can give the focus back to it. */
		helpButton?: HTMLButtonElement;
	}

	let { helpOpen, ontogglehelp, helpButton = $bindable() }: Props = $props();
</script>

<div class="settings">
	<label class="check-row">
		<input
			type="checkbox"
			checked={moderationPrefs.collapseSevere}
			onchange={(event) => moderationPrefs.setCollapseSevere(event.currentTarget.checked)}
		/>
		Collapse comments of severity {REJECT_MIN_SEVERITY} and above
	</label>
	<label class="check-row keys">
		<input
			type="checkbox"
			checked={moderationPrefs.shortcuts}
			onchange={(event) => moderationPrefs.setShortcuts(event.currentTarget.checked)}
		/>
		Single-key shortcuts
	</label>
	<button
		class="chip keys"
		type="button"
		aria-expanded={helpOpen}
		aria-controls="shortcut-list"
		aria-keyshortcuts={moderationPrefs.shortcuts ? '?' : undefined}
		bind:this={helpButton}
		onclick={ontogglehelp}
	>
		Keyboard shortcuts
	</button>
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.settings {
		@apply flex flex-wrap items-center;
		gap: var(--spacing-xs) var(--spacing-lg);
	}

	/* A phone has no keyboard to press the shortcuts on: the controls for them leave the header, so the first row sits higher. */
	@media (pointer: coarse) and (not (any-hover: hover)) {
		.keys {
			display: none;
		}
	}
</style>
