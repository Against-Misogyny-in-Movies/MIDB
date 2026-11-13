<script lang="ts">
	import ProfileRows from '#lib/components/user/profileRows.svelte';
	import ProfileTitleLink from '#lib/components/user/profileTitleLink.svelte';
	import type { ProfileReport } from '#lib/media/types/profile.ts';

	interface Props {
		reports: ProfileReport[];
	}

	let { reports }: Props = $props();
</script>

<ProfileRows
	items={reports}
	key={(report) => `${report.kind}:${report.tmdbId}:${report.name}`}
	empty="No counted community reports."
>
	{#snippet row(report)}
		<ProfileTitleLink kind={report.kind} tmdbId={report.tmdbId} name={report.name} />
	{/snippet}
</ProfileRows>
