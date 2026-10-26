<script lang="ts">
	import FactList from './factList.svelte';
	import { countryName, formatDate, formatRuntime, languageName } from '$lib/media/utils/format';
	import type { Series } from '$lib/media/types/series';

	interface Props {
		series: Series;
	}

	let { series }: Props = $props();

	const facts = $derived([
		{ label: 'First aired', value: formatDate(series.firstAirDate) },
		{ label: 'Last aired', value: formatDate(series.lastAirDate) },
		{ label: 'Seasons', value: String(series.numberOfSeasons || '—') },
		{ label: 'Episodes', value: String(series.numberOfEpisodes || '—') },
		{
			label: 'Episode runtime',
			value: series.episodeRunTime.length ? formatRuntime(series.episodeRunTime[0]) : '—'
		},
		{ label: 'Networks', value: series.networks.map((n) => n.name).join(', ') || '—' },
		{ label: 'Created by', value: series.createdBy.map((c) => c.name).join(', ') || '—' },
		{
			label: 'Country',
			value: series.originCountry.map((c) => countryName(c)).join(', ') || '—'
		},
		{
			label: 'Language',
			value: series.originalLanguage ? languageName(series.originalLanguage) : '—'
		}
	]);
</script>

<FactList {facts} />
