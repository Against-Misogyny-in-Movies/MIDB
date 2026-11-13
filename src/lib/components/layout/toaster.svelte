<script lang="ts">
	import { toasts, type Toast, type ToastTone } from '#lib/media/utils/toasts.svelte.js';

	const ICONS: Record<ToastTone, string> = {
		success: 'ri-checkbox-circle-fill',
		warn: 'ri-error-warning-fill',
		error: 'ri-close-circle-fill'
	};

	const polite = $derived(toasts.items.filter((t) => t.tone !== 'error'));
	const urgent = $derived(toasts.items.filter((t) => t.tone === 'error'));
</script>

{#snippet item(toast: Toast)}
	<li
		class="toast toast--{toast.tone}"
		onmouseenter={() => toasts.pause(toast.id)}
		onmouseleave={() => toasts.resume(toast.id)}
		onfocusin={() => toasts.pause(toast.id)}
		onfocusout={() => toasts.resume(toast.id)}
	>
		<i class="icon {ICONS[toast.tone]}" aria-hidden="true"></i>
		<p class="text">{toast.text}</p>
		<button class="close" type="button" aria-label="Close" onclick={() => toasts.dismiss(toast.id)}>
			<i class="ri-close-line" aria-hidden="true"></i>
		</button>
	</li>
{/snippet}

<!-- Both regions are in the page from the first paint, so a screen reader announces what is added
     to them: errors at once, the rest politely. -->
<section class="toaster" aria-label="Notifications">
	<ol class="stack" role="alert" aria-live="assertive">
		{#each urgent as toast (toast.id)}{@render item(toast)}{/each}
	</ol>
	<ol class="stack" role="status" aria-live="polite">
		{#each polite as toast (toast.id)}{@render item(toast)}{/each}
	</ol>
</section>

<style lang="postcss">
	@reference "../../../app.css";

	.toaster {
		@apply fixed flex flex-col;
		right: var(--spacing-md);
		bottom: var(--spacing-md);
		z-index: 50;
		width: min(24rem, calc(100vw - 2 * var(--spacing-md)));
		pointer-events: none;
	}

	/* An empty region stays rendered (an empty list has no height), so a screen reader is
	   already watching it when the first toast arrives. */
	.stack {
		@apply flex flex-col list-none m-0 p-0;
		gap: var(--spacing-sm);
	}

	.stack:not(:empty) + .stack:not(:empty) {
		margin-top: var(--spacing-sm);
	}

	.toast {
		@apply flex items-start text-sm;
		gap: var(--spacing-sm);
		padding: 12px 8px 12px 16px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background-color: var(--surface-raised);
		box-shadow: var(--shadow-md);
		pointer-events: auto;
		animation: toast-in 0.15s ease;
	}

	.icon {
		@apply shrink-0;
		font-size: 1.125rem;
		line-height: 1.25rem;
	}

	.toast--success .icon {
		color: var(--success);
	}

	.toast--warn .icon {
		color: var(--warn);
	}

	.toast--error .icon {
		color: var(--danger);
	}

	.text {
		@apply flex-1 m-0 text-ink;
		line-height: 1.25rem;
	}

	.close {
		@apply shrink-0 inline-flex items-center justify-center text-ink-muted;
		width: 1.75rem;
		height: 1.75rem;
		margin-block: -4px;
		border-radius: 8px;
		transition: background-color 0.15s ease;
	}

	.close:hover {
		background-color: var(--surface-sunken);
		color: var(--ink);
	}

	@media (pointer: coarse) {
		.close {
			width: 2.75rem;
			height: 2.75rem;
			margin-block: -12px;
		}
	}

	@keyframes toast-in {
		from {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.toast {
			animation: none;
		}

		.close {
			transition: none;
		}
	}
</style>
