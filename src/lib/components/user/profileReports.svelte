<script lang="ts">
	import ProfileRows from '#lib/components/user/profileRows.svelte';
	import ProfileTitleLink from '#lib/components/user/profileTitleLink.svelte';
	import { describeStatus } from '#lib/media/utils/commentApi.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { ProfilePager } from '#lib/media/utils/profilePager.svelte.js';
	import type { ProfileReport, ProfileReportPage } from '#lib/media/types/profile.ts';

	interface Props {
		username: string;
		/** The first page, from the cached page load. */
		first: ProfileReportPage;
	}

	let { username, first }: Props = $props();

	const FAILED = 'More community reports could not be loaded';

	const pager = new ProfilePager<ProfileReport, ProfileReportPage>({
		first: () => ({ items: first.reports, nextCursor: first.nextCursor }),
		path: (cursor) =>
			`/api/users/${encodeURIComponent(username)}/reports?cursor=${encodeURIComponent(cursor)}`,
		read: (page) => ({ items: page.reports, nextCursor: page.nextCursor }),
		key: (report) => `${report.kind}:${report.tmdbId}:${report.name}`,
		failure: (status) =>
			describeStatus(FAILED, status, {
				forbidden: `${FAILED}. Try again in a moment.`,
				badRequest: `${FAILED}. Try again in a moment.`
			})
	});
	let moreButton: HTMLButtonElement | undefined = $state();

	async function showMore() {
		const firstNew = await pager.showMore();
		await focusAfterUpdate(() =>
			firstNew === null ? moreButton : document.getElementById(`profile-report-${firstNew}`)
		);
	}
</script>

<ProfileRows
	items={pager.shown}
	key={(report) => `${report.kind}:${report.tmdbId}:${report.name}`}
	rowId={(_report, index) => `profile-report-${index}`}
	empty="No counted community reports."
>
	{#snippet row(report)}
		<ProfileTitleLink kind={report.kind} tmdbId={report.tmdbId} name={report.name} />
	{/snippet}
</ProfileRows>
{#if pager.shown.length > 0 && pager.nextCursor}
	<div class="more">
		<button
			class="btn btn--ink"
			type="button"
			aria-busy={pager.busy}
			bind:this={moreButton}
			onclick={showMore}
		>
			Show more community reports
		</button>
	</div>
{/if}

<style lang="postcss">
	@reference "../../../app.css";

	.more {
		padding: var(--spacing-md) 20px;
		border-top: 1px solid var(--border);
	}
</style>
