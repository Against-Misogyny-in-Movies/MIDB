<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Anchor id used by the in-page nav and deep links. */
		id: string;
		title: string;
		/** Remixicon class for the icon disk. */
		icon: string;
		/** CSS colour for the disk, normally a source shade (`var(--src-bechdel)`). */
		hue: string;
		/** External source link. */
		sourceLabel?: string;
		sourceHref?: string;
		children: Snippet;
	}

	let { id, title, icon, hue, sourceLabel, sourceHref, children }: Props = $props();
</script>

<section {id} class="card article" aria-labelledby="{id}-title">
	<header>
		<span class="disk" style="--hue: {hue}" aria-hidden="true"><i class={icon}></i></span>
		<h2 id="{id}-title" class="display title">{title}</h2>
	</header>

	<div class="body">
		{@render children()}

		{#if sourceHref && sourceLabel}
			<p class="source">
				Source: <a class="link" href={sourceHref} target="_blank" rel="noopener noreferrer"
					>{sourceLabel}</a
				>
			</p>
		{/if}
	</div>
</section>

<style lang="postcss">
	@reference "../../../app.css";

	.article {
		scroll-margin-top: 5rem;
	}

	header {
		@apply flex items-center gap-sm border-b border-border;
		padding: 24px 32px;
	}

	.title {
		font-size: 1.5rem;
		line-height: 1.33;
		margin-left: 4px;
	}

	.body {
		@apply flex flex-col gap-md text-ink-muted;
		padding: 24px 32px 32px;
	}

	.body :global(strong) {
		@apply font-semibold text-ink;
	}

	.source {
		@apply text-sm text-ink-muted;
	}

	@media (max-width: 479px) {
		header,
		.body {
			padding-inline: 20px;
		}
	}
</style>
