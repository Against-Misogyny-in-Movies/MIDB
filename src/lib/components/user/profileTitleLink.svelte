<script lang="ts">
	import { titleHref } from '#lib/media/utils/titleHref.ts';
	import type { TitleKind } from '#lib/server/data/title-queries.ts';

	interface Props {
		kind: TitleKind;
		tmdbId: number | null;
		name: string;
	}

	let { kind, tmdbId, name }: Props = $props();

	const href = $derived(titleHref(kind, tmdbId));
</script>

{#if href}<a class="link title" {href}>{name}</a>{:else}<span class="title">{name}</span>{/if}

<style lang="postcss">
	@reference "../../../app.css";

	.title {
		@apply font-semibold;
	}

	/* A touch target is 44px on a coarse pointer, like the buttons; a fine pointer keeps the row's height. */
	@media (pointer: coarse) {
		a.title {
			display: inline-flex;
			align-items: center;
			min-height: 2.75rem;
		}
	}
</style>
