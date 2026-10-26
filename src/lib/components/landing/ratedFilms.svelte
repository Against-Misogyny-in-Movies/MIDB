<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/ui/badge.svelte';
	import { displayTitle } from '$lib/media/utils/format';
	import { bechdelTone, safetyTierTone } from '$lib/media/utils/tones';
	import type { RatedFilm } from '$lib/media/types/catalogue';

	interface Props {
		films: RatedFilm[];
		/** Rows without a TMDB id can't link to their page; they run the title through search. */
		onsearch: (title: string) => void;
	}

	let { films, onsearch }: Props = $props();

	function umLabel(film: RatedFilm): string {
		if (film.umConcerns === null) return 'No entry';
		if (film.umConcerns === 0) return 'No concerns';
		return `${film.umConcerns} concern${film.umConcerns === 1 ? '' : 's'}`;
	}
</script>

<section class="card rated-films" aria-labelledby="rated-films-title">
	<header class="card-head">
		<h2 id="rated-films-title">Popular films</h2>
		<p>Most IMDb votes among films with a Bechdel Test rating</p>
	</header>

	<table>
		<thead>
			<tr>
				<th scope="col">Film</th>
				<th scope="col" class="col-badge">Bechdel Test</th>
				<th scope="col" class="col-badge">Unconsenting Media</th>
			</tr>
		</thead>
		<tbody>
			{#each films as film (film.title + film.year)}
				{@const title = displayTitle(film.title)}
				<tr>
					<th scope="row">
						{#if film.tmdbId}
							<a class="film" href={resolve('/movie/[movieId]', { movieId: String(film.tmdbId) })}>
								<span class="year">{film.year ?? '—'}</span>
								<span class="name">{title}</span>
							</a>
						{:else}
							<button
								type="button"
								class="film"
								aria-label="Search for {title}"
								onclick={() => onsearch(title)}
							>
								<span class="year">{film.year ?? '—'}</span>
								<span class="name">{title}</span>
							</button>
						{/if}
					</th>
					<td class="col-badge">
						<Badge tone={bechdelTone(film.bechdelRating)}>{film.bechdelRating}/3</Badge>
					</td>
					<td class="col-badge">
						<Badge tone={safetyTierTone(film.umTier)}>{umLabel(film)}</Badge>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<style lang="postcss">
	@reference "../../../app.css";

	.rated-films {
		box-shadow: var(--shadow-float);
		padding: 8px 16px 12px;
	}

	.card-head {
		padding: 12px 0;
		border-bottom: 2px solid var(--surface-sunken);
	}

	h2 {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--ink);
	}

	.card-head p {
		font-size: 0.75rem;
		line-height: 1.33;
		color: var(--ink-muted);
		margin-top: 2px;
	}

	table {
		@apply w-full border-collapse;
		font-size: 0.875rem;
	}

	thead th {
		@apply text-left font-medium;
		font-size: 0.75rem;
		color: var(--ink-muted);
		padding: 10px 0 6px;
	}

	tbody tr + tr {
		border-top: 1px solid var(--surface-sunken);
	}

	tbody th,
	td {
		@apply text-left font-normal align-middle;
		height: 3.5rem;
	}

	.col-badge {
		width: 1%;
		white-space: nowrap;
		padding-left: 16px;
	}

	.film {
		@apply flex items-center w-full text-left bg-transparent border-0 p-0 cursor-pointer no-underline;
		gap: 12px;
		font: inherit;
		color: var(--ink);
	}

	.year {
		@apply flex items-center justify-center shrink-0;
		width: 2.75rem;
		height: 2rem;
		border-radius: 8px;
		background-color: var(--brand-wash);
		color: var(--brand);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		letter-spacing: -0.033em;
	}

	.name {
		@apply font-medium;
		line-height: 1.3;
		transition: color 0.15s ease;
	}

	.film:hover .name {
		color: var(--brand);
	}

	@media (max-width: 559px) {
		.year {
			display: none;
		}

		.col-badge {
			padding-left: 8px;
		}
	}
</style>
