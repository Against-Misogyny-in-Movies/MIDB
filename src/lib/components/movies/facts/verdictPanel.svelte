<script lang="ts">
	import type { SafetyVerdict, RepVerdict } from '$lib/media/utils/verdict';
	import VerdictCard from './verdictCard.svelte';

	interface Props {
		safety: SafetyVerdict;
		representation: RepVerdict;
	}

	let { safety, representation }: Props = $props();
</script>

<section class="verdict-panel" aria-label="Verdict">
	<VerdictCard verdict={safety} />
	<VerdictCard verdict={representation} />
</section>

<style lang="postcss">
	@reference "../../../../app.css";

	.verdict-panel {
		@apply grid items-start gap-sm;
		grid-template-columns: 1fr;
	}

	@media (min-width: 560px) {
		.verdict-panel {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
