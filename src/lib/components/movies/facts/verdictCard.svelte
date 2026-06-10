<script lang="ts">
	import type { AxisVerdict } from '$lib/media/utils/verdict';
	import { toneTokens } from '$lib/media/utils/verdict';

	interface Props {
		verdict: AxisVerdict<string>;
	}

	let { verdict }: Props = $props();

	const tokens = $derived(toneTokens(verdict.tone));
	const hasDetail = $derived(verdict.signals.length > 0);

	let open = $state(false);
	let hovering = $state(false);

	// Touch: the popover dismisses on scroll (matching dddTags), so a tapped-open
	// card doesn't linger over content the user has scrolled past. Clear `hovering`
	// too — a tap can fire focus/mouseenter, and that path has no scroll dismiss.
	// Use the capture phase so scrolls from any nested scroll container are caught —
	// the `scroll` event doesn't bubble, so a non-capturing window listener misses
	// them. Capturing on window is also how dddTags registers its dismiss handler.
	$effect(() => {
		if (!open && !hovering) return;
		const dismiss = () => {
			open = false;
			hovering = false;
		};
		window.addEventListener('scroll', dismiss, { capture: true, passive: true });
		return () => window.removeEventListener('scroll', dismiss, { capture: true });
	});
</script>

<div
	class="card-wrap"
	style="--vt-fg: var({tokens.fg}); --vt-soft: var({tokens.soft}); --vt-on: var({tokens.on});"
>
	{#if hasDetail}
		<button
			class="card"
			type="button"
			aria-expanded={open}
			aria-label="{verdict.label}. {verdict.summary}"
			onmouseenter={() => (hovering = true)}
			onmouseleave={() => (hovering = false)}
			onfocus={() => (hovering = true)}
			onblur={() => (hovering = false)}
			onclick={() => (open = !open)}
		>
			<span class="icon-chip" aria-hidden="true">
				<i class={verdict.icon}></i>
			</span>
			<div class="content">
				<span class="label">{verdict.label}</span>
				<span class="summary">{verdict.summary}</span>
				<span class="confidence" aria-busy={verdict.pending ? 'true' : undefined}>
					Based on {verdict.signalsPresent} of {verdict.signalsTotal} metrics{verdict.pending
						? ' · updating…'
						: ''}
				</span>
			</div>
		</button>
	{:else}
		<div class="card card--static">
			<span class="icon-chip" aria-hidden="true">
				<i class={verdict.icon}></i>
			</span>
			<div class="content">
				<span class="label">{verdict.label}</span>
				<span class="summary">{verdict.summary}</span>
				<span class="confidence" aria-busy={verdict.pending ? 'true' : undefined}>
					Based on {verdict.signalsPresent} of {verdict.signalsTotal} metrics{verdict.pending
						? ' · updating…'
						: ''}
				</span>
			</div>
		</div>
	{/if}

	{#if hasDetail}
		<!-- Popover: revealed on hover/focus (desktop) or tap (touch). -->
		<div class="detail-pop" class:detail-pop--visible={hovering || open} role="tooltip">
			<ul class="sig-list">
				{#each verdict.signals as sig}
					{@const sigTokens = toneTokens(sig.tone ?? verdict.tone)}
					<li class="sig" style="--sig-fg: var({sigTokens.fg});">
						<span class="sig-dot" aria-hidden="true"></span>
						<span class="sig-label">{sig.label}</span>
						<span class="sig-detail">{sig.detail}</span>
					</li>
				{/each}
				<li class="sig sig--meta">
					Based on {verdict.signalsPresent} of {verdict.signalsTotal} metrics
				</li>
			</ul>
		</div>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.card-wrap {
		@apply relative flex flex-col;
	}

	.card {
		@apply flex items-start gap-sm p-md rounded-md border border-border w-full text-left flex-1;
		background-color: color-mix(in oklab, var(--vt-fg) 6%, var(--surface-raised));
		border-left: 3px solid var(--vt-fg);
		font: inherit;
		cursor: help;
		transition:
			border-color 0.15s ease,
			background-color 0.15s ease;

		@media (prefers-reduced-motion: reduce) {
			transition: none;
		}
	}

	.card--static {
		@apply cursor-default;
	}

	.card:focus-visible {
		@apply outline-none;
		box-shadow: 0 0 0 2px var(--brand);
	}

	.icon-chip {
		@apply flex items-center justify-center rounded-full shrink-0 text-lg;
		width: 2.25rem;
		height: 2.25rem;
		background-color: color-mix(in oklab, var(--vt-fg) 16%, transparent);
		color: var(--vt-fg);
		transition: background-color 0.15s ease;

		@media (prefers-reduced-motion: reduce) {
			transition: none;
		}
	}

	.content {
		@apply flex flex-col gap-xs min-w-0 flex-1;
	}

	.label {
		@apply text-sm font-semibold text-ink leading-tight;
		font-family: var(--font-display);
	}

	.summary {
		@apply text-xs text-ink-muted leading-snug;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.confidence {
		@apply text-xs text-ink-muted;
		opacity: 0.7;
	}

	/* ── Desktop popover ── */
	.detail-pop {
		@apply absolute left-0 right-0 z-30 rounded-md border border-border p-sm;
		top: calc(100% - 1px);
		background-color: color-mix(in oklab, var(--vt-fg) 4%, var(--surface-raised));
		box-shadow: 0 4px 16px -4px color-mix(in oklab, var(--ink) 20%, transparent);
		opacity: 0;
		pointer-events: none;
		transform: translateY(-4px);
		transition:
			opacity 0.14s ease,
			transform 0.14s ease;

		@media (prefers-reduced-motion: reduce) {
			transition: opacity 0.14s ease;
			transform: none;
		}
	}

	.detail-pop--visible {
		opacity: 1;
		pointer-events: auto;
		transform: translateY(0);

		@media (prefers-reduced-motion: reduce) {
			transform: none;
		}
	}

	/* ── Signal list ── */
	.sig-list {
		@apply flex flex-col list-none m-0 p-0 gap-xs;
	}

	.sig {
		@apply grid items-center gap-sm text-xs;
		grid-template-columns: auto 1fr auto;
	}

	.sig-dot {
		@apply rounded-full shrink-0;
		width: 0.375rem;
		height: 0.375rem;
		background-color: var(--sig-fg);
	}

	.sig-label {
		@apply text-ink;
	}

	.sig-detail {
		@apply text-ink-muted tabular-nums;
	}

	.sig--meta {
		@apply col-span-3 text-ink-muted mt-xs pt-xs border-t border-border;
		opacity: 0.7;
		grid-template-columns: none;
	}
</style>
