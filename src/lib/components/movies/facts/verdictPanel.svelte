<script lang="ts">
	import type { SafetyVerdict, RepVerdict } from '$lib/media/utils/verdict';
	import VerdictCard from './verdictCard.svelte';

	interface Props {
		safety: SafetyVerdict;
		representation: RepVerdict;
	}

	let { safety, representation }: Props = $props();
</script>

<div class="verdict-panel" aria-label="At-a-glance verdict">
	<VerdictCard verdict={safety} />
	<VerdictCard verdict={representation} />
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.verdict-panel {
		@apply grid gap-sm mt-xs;
		grid-template-columns: 1fr;
	}

	@media (min-width: 480px) {
		.verdict-panel {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
