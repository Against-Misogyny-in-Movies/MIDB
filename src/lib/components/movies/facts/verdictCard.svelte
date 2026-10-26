<script lang="ts">
	import type { AxisVerdict } from '$lib/media/utils/verdict';
	import { toneTokens } from '$lib/media/utils/verdict';

	interface Props {
		verdict: AxisVerdict<string>;
	}

	let { verdict }: Props = $props();

	const tokens = $derived(toneTokens(verdict.tone));
	const axisLabel = $derived(verdict.axis === 'safety' ? 'Content safety' : 'Representation');
	const basis = $derived(
		`Based on ${verdict.signalsPresent} of ${verdict.signalsTotal} metrics${verdict.pending ? ', loading…' : ''}`
	);
</script>

<!-- Every line is present from first paint and the summary keeps a fixed two-line box, so the DDD
     stream updating the safety card never moves the page. The signal list is a disclosure the
     visitor opens, so it works the same with a mouse, a keyboard and on touch. -->
<div class="verdict" style="--tone: var({tokens.fg}); --tone-soft: var({tokens.soft});">
	<p class="axis">{axisLabel}</p>
	<p class="tier display">{verdict.label}</p>
	<p class="summary">{verdict.summary}</p>

	{#if verdict.signals.length > 0}
		<details class="basis">
			<summary aria-busy={verdict.pending ? 'true' : undefined}>
				{basis}
				<i class="ri-arrow-down-s-line chevron" aria-hidden="true"></i>
			</summary>
			<ul class="signals">
				{#each verdict.signals as sig (sig.label)}
					<li class="signal" style="--sig: var({toneTokens(sig.tone ?? verdict.tone).fg});">
						<span class="signal-label">{sig.label}</span>
						<span class="signal-detail num">{sig.detail}</span>
					</li>
				{/each}
			</ul>
			<a class="link how" href="/resources#verdict">How verdicts work</a>
		</details>
	{:else}
		<p class="basis-text" aria-busy={verdict.pending ? 'true' : undefined}>{basis}</p>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.verdict {
		@apply flex flex-col rounded-md p-md;
		background-color: var(--tone-soft);
		transition: background-color 0.15s ease;
	}

	.axis {
		@apply text-sm;
		color: color-mix(in oklab, var(--tone) 70%, var(--ink));
	}

	.tier {
		@apply text-2xl;
		color: var(--tone);
		margin-top: 0.125rem;
	}

	/* Two lines reserved and clamped: the summary can change when DDD streams in. */
	.summary {
		@apply text-sm text-ink line-clamp-2;
		min-height: 2.5rem;
		margin-top: var(--spacing-xs);
	}

	.basis,
	.basis-text {
		@apply text-sm;
		margin-top: var(--spacing-sm);
		color: color-mix(in oklab, var(--tone) 55%, var(--ink));
	}

	summary {
		@apply inline-flex items-center gap-xs cursor-pointer select-none;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary:hover {
		@apply text-ink;
	}

	.chevron {
		transition: transform 0.15s ease;
	}

	.basis[open] .chevron {
		transform: rotate(180deg);
	}

	.signals {
		@apply flex flex-col list-none m-0 p-0;
		margin-top: var(--spacing-sm);
		border-top: 1px solid color-mix(in oklab, var(--tone) 20%, transparent);
	}

	.signal {
		@apply flex items-baseline justify-between gap-md text-ink;
		padding-block: var(--spacing-xs);
		border-bottom: 1px solid color-mix(in oklab, var(--tone) 20%, transparent);
	}

	.signal-label {
		@apply flex items-baseline gap-sm;
	}

	.signal-label::before {
		content: '';
		@apply inline-block rounded-full shrink-0;
		width: 0.5rem;
		height: 0.5rem;
		background-color: var(--sig);
	}

	.signal-detail {
		@apply text-ink-muted text-right;
	}

	.how {
		@apply inline-block;
		margin-top: var(--spacing-sm);
	}

	@media (prefers-reduced-motion: reduce) {
		.verdict,
		.chevron {
			transition: none;
		}
	}
</style>
