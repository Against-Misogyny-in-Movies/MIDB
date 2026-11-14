<script lang="ts">
	import { formatDate, formatShortDate } from '#lib/media/utils/format.ts';

	interface Props {
		/** The comment's address on its title page; without one the date is plain text. */
		href?: string;
		createdAt: string;
		/** Classes of the host row's date (`label`, `num`). */
		class?: string;
		/** The month abbreviated (`Nov 14, 2026`), for dense rows. */
		short?: boolean;
	}

	let { href, createdAt, class: className = '', short = false }: Props = $props();

	const text = $derived(short ? formatShortDate(createdAt) : formatDate(createdAt));
</script>

{#if href}
	<a class="link date {className}" {href}>
		<time datetime={createdAt}>{text}</time>
	</a>
{:else}
	<time class={className} datetime={createdAt}>{text}</time>
{/if}

<style>
	/* A touch target is 44px on a coarse pointer, like the buttons; a fine pointer keeps the row's height. */
	@media (pointer: coarse) {
		.date {
			display: inline-flex;
			align-items: center;
			min-height: 2.75rem;
		}
	}
</style>
