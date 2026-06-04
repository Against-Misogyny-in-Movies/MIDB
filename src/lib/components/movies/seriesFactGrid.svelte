<script lang="ts">
	import { countryName, languageName, formatRuntime } from '$lib/movie/format';
	import type { Series } from '../../../routes/tv/[seriesId]/types';

	interface Props {
		series: Series;
	}

	let { series }: Props = $props();

	const genres = $derived(series.genres.length ? series.genres.map((g) => g.name).join(', ') : '—');
	const countries = $derived(
		series.originCountry.length ? series.originCountry.map((c) => countryName(c)).join(', ') : '—'
	);
	const originalLang = $derived(
		series.originalLanguage ? languageName(series.originalLanguage) : '—'
	);
	const networks = $derived(
		series.networks.length ? series.networks.map((n) => n.name).join(', ') : '—'
	);
	const createdBy = $derived(
		series.createdBy.length ? series.createdBy.map((c) => c.name).join(', ') : '—'
	);
	const episodeRuntime = $derived(
		series.episodeRunTime.length ? formatRuntime(series.episodeRunTime[0]) : '—'
	);
</script>

<dl class="fact-grid">
	<div class="fact">
		<dt class="label">Seasons</dt>
		<dd>{series.numberOfSeasons || '—'}</dd>
	</div>
	<div class="fact">
		<dt class="label">Episodes</dt>
		<dd>{series.numberOfEpisodes || '—'}</dd>
	</div>
	<div class="fact">
		<dt class="label">Ep. runtime</dt>
		<dd>{episodeRuntime}</dd>
	</div>
	<div class="fact">
		<dt class="label">First aired</dt>
		<dd>{series.firstAirDate || '—'}</dd>
	</div>
	<div class="fact">
		<dt class="label">Last aired</dt>
		<dd>{series.lastAirDate || '—'}</dd>
	</div>
	<div class="fact">
		<dt class="label">Networks</dt>
		<dd>{networks}</dd>
	</div>
	<div class="fact">
		<dt class="label">Created by</dt>
		<dd>{createdBy}</dd>
	</div>
	<div class="fact">
		<dt class="label">Genres</dt>
		<dd>{genres}</dd>
	</div>
	<div class="fact">
		<dt class="label">Country</dt>
		<dd>{countries}</dd>
	</div>
	<div class="fact">
		<dt class="label">Language</dt>
		<dd>{originalLang}</dd>
	</div>
</dl>

<style lang="postcss">
	@reference "../../../app.css";

	.fact-grid {
		@apply grid gap-md;
		grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
	}

	.fact {
		@apply flex flex-col gap-xs;
	}

	dt {
		@apply text-ink-muted;
	}

	dd {
		@apply text-ink;
	}
</style>
