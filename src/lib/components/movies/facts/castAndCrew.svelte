<script lang="ts">
	import CollapsibleSection from '$lib/components/movies/sections/collapsibleSection.svelte';
	import GenderDistribution from './genderDistribution.svelte';
	import CastRepresentation from './castRepresentation.svelte';
	import CrewRepresentation from './crewRepresentation.svelte';
	import RepresentationDisclosure from './representationDisclosure.svelte';
	import type { MediaDetail } from '$lib/media/types/media';

	interface Props {
		media: MediaDetail;
	}

	let { media }: Props = $props();

	// Same share the cast legend shows (women over all credited cast, unknown included).
	const castShare = $derived(media.cast.total === 0 ? null : media.cast.female / media.cast.total);
	const status = $derived(
		castShare === null ? 'No data' : `${Math.round(castShare * 100)}% women in cast`
	);
</script>

<div id="gender">
	<CollapsibleSection
		title="Cast and crew"
		{status}
		tone={castShare === null ? 'empty' : 'data'}
		sourceLabel="TMDB"
		sourceHref="https://www.themoviedb.org"
		learnHref="/resources#verdict"
		learnLabel="How representation is scored"
	>
		<div class="group">
			<h3>Cast</h3>
			<GenderDistribution label="Cast" breakdown={media.cast} />
			{#if media.castMembers.length > 0}
				<RepresentationDisclosure label="cast by billing order">
					<CastRepresentation castMembers={media.castMembers} />
				</RepresentationDisclosure>
			{/if}
		</div>

		<div class="group">
			<h3>Crew</h3>
			<GenderDistribution label="Crew" breakdown={media.crew} />
			{#if media.crewDepartments.length > 0}
				<RepresentationDisclosure label="crew by department">
					<CrewRepresentation crewDepartments={media.crewDepartments} />
				</RepresentationDisclosure>
			{/if}
		</div>
	</CollapsibleSection>
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.group {
		@apply flex flex-col gap-sm;
	}

	.group + .group {
		margin-top: var(--spacing-md);
	}

	h3 {
		@apply font-semibold text-ink;
	}
</style>
