<script lang="ts">
	import type { TriggerTag } from '../../../routes/movie/[movieId]/ddd.server';
	import type { Series } from '../../../routes/tv/[seriesId]/types';

	interface Props {
		seasons: Series['seasons'];
		tags: TriggerTag[];
		selectedSeason: number | null;
		selectedEpisode: number | null;
		onchange: (season: number | null, episode: number | null) => void;
	}

	let { seasons, tags, selectedSeason, selectedEpisode, onchange }: Props = $props();

	// Only show seasons that have at least one DDD stat or are season > 0
	const selectableSeasons = $derived(seasons.filter((s) => s.seasonNumber > 0));

	// Episodes with DDD data for the selected season
	const availableEpisodes = $derived.by(() => {
		if (selectedSeason === null) return [];
		const eps = new Set<number>();
		for (const tag of tags) {
			if (tag.season === selectedSeason && tag.episode !== null && tag.episode > 0) {
				eps.add(tag.episode);
			}
		}
		return [...eps].sort((a, b) => a - b);
	});

	function handleSeasonChange(e: Event) {
		const val = (e.currentTarget as HTMLSelectElement).value;
		const season = val === '' ? null : parseInt(val, 10);
		onchange(season, null);
	}

	function handleEpisodeChange(e: Event) {
		const val = (e.currentTarget as HTMLSelectElement).value;
		const episode = val === '' ? null : parseInt(val, 10);
		onchange(selectedSeason, episode);
	}
</script>

<div class="episode-selector">
	<div class="selects">
		<label class="select-wrap">
			<span class="select-label label">Season</span>
			<select
				class="select"
				value={selectedSeason === null ? '' : String(selectedSeason)}
				onchange={handleSeasonChange}
			>
				<option value="">Whole series</option>
				{#each selectableSeasons as season (season.seasonNumber)}
					<option value={String(season.seasonNumber)}>
						Season {season.seasonNumber}
						{season.name && season.name !== `Season ${season.seasonNumber}`
							? ` — ${season.name}`
							: ''}
					</option>
				{/each}
			</select>
		</label>

		<label class="select-wrap">
			<span class="select-label label">Episode</span>
			<select
				class="select"
				disabled={selectedSeason === null || availableEpisodes.length === 0}
				value={selectedEpisode === null ? '' : String(selectedEpisode)}
				onchange={handleEpisodeChange}
			>
				<option value="">All episodes</option>
				{#each availableEpisodes as ep (ep)}
					<option value={String(ep)}>Episode {ep}</option>
				{/each}
			</select>
		</label>
	</div>

</div>

<style lang="postcss">
	@reference "../../../app.css";

	.episode-selector {
		@apply flex flex-col gap-xs mb-md;
	}

	.selects {
		@apply flex flex-wrap gap-sm;
	}

	.select-wrap {
		@apply flex flex-col gap-xs;
	}

	.select-label {
		@apply text-xs text-ink-muted uppercase tracking-wide;
		font-variant-caps: all-small-caps;
	}

	.select {
		@apply px-sm py-xs rounded-md border border-border bg-surface text-sm text-ink cursor-pointer;
		transition: border-color 0.15s ease;
	}

	.select:focus {
		@apply outline-none;
		border-color: var(--brand);
	}

	.select:disabled {
		@apply opacity-50 cursor-not-allowed;
	}

</style>
