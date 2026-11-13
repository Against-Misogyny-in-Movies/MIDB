<script lang="ts">
	import { formatDate } from '#lib/media/utils/format.ts';

	interface Props {
		/** The comment's address on its title page; without one the date is plain text. */
		href?: string;
		createdAt: string;
		/** Classes of the host row's date (`label`, `num`). */
		class?: string;
	}

	let { href, createdAt, class: className = '' }: Props = $props();
</script>

{#if href}
	<a class="link date {className}" {href}>
		<time datetime={createdAt}>{formatDate(createdAt)}</time>
	</a>
{:else}
	<time class={className} datetime={createdAt}>{formatDate(createdAt)}</time>
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
