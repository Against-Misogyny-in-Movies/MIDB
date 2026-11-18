<script lang="ts">
	import Badge from '#lib/components/ui/badge.svelte';
	import ProfileTitleLink from '#lib/components/user/profileTitleLink.svelte';
	import type { AccountReport } from '#lib/media/types/moderation.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { effectiveStanding, moderatorStandingLabel } from '#lib/media/utils/reportStanding.ts';

	interface Props {
		report: AccountReport;
	}

	let { report }: Props = $props();

	const standing = $derived(
		moderatorStandingLabel(
			effectiveStanding({
				status: report.status,
				countsFrom: report.countsFrom,
				restricted: report.restricted
			})
		)
	);
</script>

<li class="row">
	<ProfileTitleLink kind={report.kind} tmdbId={report.tmdbId} name={report.title} />
	<Badge tone={standing.tone}>{standing.label}</Badge>
	<time class="label" datetime={report.updatedAt}>{formatDate(report.updatedAt)}</time>
</li>

<style lang="postcss">
	@reference "../../../../app.css";

	.row {
		@apply flex flex-wrap items-center text-sm;
		gap: var(--spacing-xs) var(--spacing-sm);
		padding: var(--spacing-md) 20px;
	}
</style>
