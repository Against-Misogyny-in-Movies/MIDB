<script lang="ts">
	import FactList from './factList.svelte';
	import {
		formatCurrency,
		formatDate,
		formatRuntime,
		countryName,
		languageName
	} from '$lib/media/utils/format';
	import type { Movie } from '$lib/media/types/movie';

	interface Props {
		movie: Movie;
	}

	let { movie }: Props = $props();

	const facts = $derived([
		{ label: 'Released', value: formatDate(movie.releaseDate) },
		{ label: 'Runtime', value: formatRuntime(movie.runtime) },
		{ label: 'Budget', value: formatCurrency(movie.budget) },
		{ label: 'Revenue', value: formatCurrency(movie.revenue) },
		{
			label: 'Country',
			value: movie.originCountry.map((c) => countryName(c)).join(', ') || '—'
		},
		{
			label: 'Language',
			value: movie.originalLanguage ? languageName(movie.originalLanguage) : '—'
		}
	]);
</script>

<FactList {facts} />
