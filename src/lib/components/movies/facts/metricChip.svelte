<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		href?: string;
		icon: string;
		label: string;
		empty?: boolean;
		badgeCount?: number;
		children?: Snippet;
	}

	let { href, icon, label, empty = false, badgeCount = 0, children }: Props = $props();
</script>

<div class="chip-wrap">
	{#if href}
		<a class="chip" {href} class:chip--empty={empty}>
			<span class="chip-icon" aria-hidden="true"><i class={icon}></i></span>
			<span class="chip-text">
				<span class="chip-label">{label}</span>
				{@render children?.()}
			</span>
		</a>
	{:else}
		<div class="chip chip--empty" aria-label="{label} — not applicable">
			<span class="chip-icon" aria-hidden="true"><i class={icon}></i></span>
			<span class="chip-text">
				<span class="chip-label">{label}</span>
				{@render children?.()}
			</span>
		</div>
	{/if}
	{#if badgeCount > 0}
		<span
			class="chip-badge"
			aria-label="{badgeCount} possible Unconsenting Media match{badgeCount === 1 ? '' : 'es'} — choose below"
		>
			<i class="ri-error-warning-line" aria-hidden="true"></i>
		</span>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.chip-wrap {
		@apply relative;
	}

	.chip {
		@apply relative flex items-center gap-sm px-md py-sm rounded-lg border border-border no-underline overflow-hidden;
		min-height: 4.5rem;
		background-image: linear-gradient(
			135deg,
			color-mix(in oklab, var(--brand) 8%, var(--surface-raised)),
			var(--surface-raised)
		);
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease,
			transform 0.15s ease;
	}

	a.chip:hover {
		border-color: var(--brand);
		transform: translateY(-2px);
		box-shadow: 0 6px 18px -8px color-mix(in oklab, var(--brand) 55%, transparent);
	}

	a.chip:focus-visible {
		@apply outline-none;
		box-shadow: 0 0 0 2px var(--brand);
	}

	.chip-icon {
		@apply flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-lg;
		background-color: color-mix(in oklab, var(--brand) 14%, transparent);
		color: var(--brand);
	}

	.chip-text {
		@apply flex flex-col gap-0 min-w-0;
	}

	.chip-label {
		@apply text-xs tracking-wide uppercase text-ink-muted truncate;
		font-variant-caps: all-small-caps;
	}

	.chip--empty {
		background-image: none;
		background-color: var(--surface-raised);
	}

	.chip--empty .chip-icon {
		background-color: var(--secondary-soft);
		color: var(--ink-muted);
	}

	.chip-badge {
		@apply absolute -top-3 -right-3 flex items-center justify-center w-7 h-7 rounded-full text-base z-10;
		background-color: var(--accent-bg);
		color: var(--accent-ink);
		box-shadow: 0 0 0 2px var(--surface-raised);
	}

	.chip-badge::after {
		content: '';
		@apply absolute inset-0 rounded-full;
		background-color: var(--accent-bg);
		opacity: 0.5;
		animation: badge-pulse 2s ease infinite;
	}

	@keyframes badge-pulse {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.5;
		}
		50% {
			transform: scale(2);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chip-badge::after {
			animation: none;
		}
	}
</style>
