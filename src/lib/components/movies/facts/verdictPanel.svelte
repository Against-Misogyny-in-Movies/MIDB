<script lang="ts">
	import type { SafetyVerdict, RepVerdict } from '$lib/media/utils/verdict';
	import VerdictCard from './verdictCard.svelte';

	interface Props {
		safety: SafetyVerdict;
		representation: RepVerdict;
	}

	let { safety, representation }: Props = $props();
</script>

<div class="verdict-wrap">
	<div class="verdict-panel" aria-label="At-a-glance verdict">
		<VerdictCard verdict={safety} />
		<VerdictCard verdict={representation} />
	</div>
	<a class="learn-link" href="/resources#verdict">
		How verdicts work <i class="ri-arrow-right-line" aria-hidden="true"></i>
	</a>
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.verdict-wrap {
		@apply flex flex-col gap-xs;
	}

	.verdict-panel {
		@apply grid gap-sm mt-xs;
		grid-template-columns: 1fr;
	}

	.learn-link {
		@apply self-start inline-flex items-center gap-xs text-xs text-ink-muted no-underline transition-colors;
	}

	.learn-link:hover {
		@apply text-brand;
	}

	@media (min-width: 480px) {
		.verdict-panel {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
