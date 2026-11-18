<script lang="ts">
	import { moderationPrefs } from '#lib/media/utils/moderationPrefs.svelte.js';
</script>

<div class="settings">
	<label class="check-row">
		<input
			type="checkbox"
			checked={moderationPrefs.collapseSevere}
			onchange={(event) => moderationPrefs.setCollapseSevere(event.currentTarget.checked)}
		/>
		Collapse the most severe comments
	</label>
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.settings {
		@apply flex flex-wrap;
		gap: var(--spacing-xs) var(--spacing-lg);
	}
</style>
