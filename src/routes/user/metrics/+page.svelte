<script lang="ts">
	import type { PageData } from './$types';
	import { titleHref } from '$lib/media/utils/titleHref';

	let { data }: { data: PageData } = $props();

	function ratingLabel(row: PageData['ratings'][number]) {
		return row.metric === 'bechdel'
			? `Bechdel Test · ${row.value}/3`
			: `Unconsenting Media · ${row.value} concern${row.value === 1 ? '' : 's'}`;
	}
</script>

<div class="account-page">
	<header>
		<a href="/user/profile" class="back"
			><i class="ri-arrow-left-s-line" aria-hidden="true"></i>Profile</a
		>
		<h1 class="display">Rating history</h1>
	</header>

	{#if data.ratings.length === 0}
		<p class="empty">No ratings yet.</p>
	{:else}
		<ul class="card history">
			{#each data.ratings as row (`${row.metric}:${row.titleId}`)}
				<li>
					<a href={titleHref(row.kind, row.tmdbId)}>
						<span class="title">{row.title}</span>
						<span class="meta">
							{ratingLabel(row)} ·
							<time datetime={row.updatedAt.toISOString()}
								>{row.updatedAt.toLocaleDateString()}</time
							>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.account-page {
		@apply flex flex-col mx-auto;
		max-width: 36rem;
		gap: var(--spacing-lg);
		padding-block: var(--spacing-xl);
	}

	.back {
		@apply inline-flex items-center text-sm text-ink-muted no-underline;
		margin-bottom: var(--spacing-sm);
	}

	.back:hover {
		@apply text-ink;
	}

	h1 {
		font-size: 1.875rem;
	}

	.empty {
		@apply text-ink-muted;
	}

	.history {
		@apply flex flex-col list-none p-0 m-0 overflow-hidden;
	}

	.history li + li {
		border-top: 1px solid var(--border);
	}

	.history a {
		@apply flex flex-col gap-xs no-underline text-ink;
		padding: 14px 20px;
	}

	.history a:hover .title {
		color: var(--brand);
	}

	.title {
		@apply font-medium;
	}

	.meta {
		@apply text-sm text-ink-muted;
	}
</style>
