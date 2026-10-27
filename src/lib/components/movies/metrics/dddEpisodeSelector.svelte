<script lang="ts">
	import type { TriggerTag } from '$lib/media/types/ddd';
	import type { Series } from '$lib/media/types/series';

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
		const eps = tags
			.filter((tag) => tag.season === selectedSeason && tag.episode !== null && tag.episode > 0)
			.map((tag) => tag.episode as number);
		return [...new Set(eps)].sort((a, b) => a - b);
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

<div class="selects">
	<label class="select-wrap">
		<span class="label">Season</span>
		<select
			value={selectedSeason === null ? '' : String(selectedSeason)}
			onchange={handleSeasonChange}
		>
			<option value="">Whole series</option>
			{#each selectableSeasons as season (season.seasonNumber)}
				<option value={String(season.seasonNumber)}>
					Season {season.seasonNumber}{season.name &&
					season.name !== `Season ${season.seasonNumber}`
						? `: ${season.name}`
						: ''}
				</option>
			{/each}
		</select>
	</label>

	<label class="select-wrap">
		<span class="label">Episode</span>
		<select
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

<style lang="postcss">
	@reference "../../../../app.css";

	.selects {
		@apply flex flex-wrap gap-md;
	}

	.select-wrap {
		@apply inline-flex items-center gap-sm;
	}
</style>
