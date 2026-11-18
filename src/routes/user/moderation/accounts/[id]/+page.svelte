<script lang="ts">
	import AccountLists from '#lib/components/moderation/account/accountLists.svelte';
	import AccountNotes from '#lib/components/moderation/account/accountNotes.svelte';
	import AccountSummary from '#lib/components/moderation/account/accountSummary.svelte';
	import PagedList from '#lib/components/moderation/pagedList.svelte';
	import RecentActionRow from '#lib/components/moderation/recentActionRow.svelte';
	import { canActOn } from '#lib/media/utils/canActOn.ts';

	let { data } = $props();

	const { account } = $derived(data);
</script>

<svelte:head>
	<title>{account.deleted ? 'Deleted account' : account.user.displayName} · Moderation · MIDB</title
	>
</svelte:head>

<div class="page">
	<header>
		<a href="/user/moderation" class="back"
			><i class="ri-arrow-left-s-line" aria-hidden="true"></i>Moderation</a
		>
	</header>

	<AccountSummary {account} me={data.me} />

	{#if data.notes}
		<AccountNotes
			userId={account.user.id}
			notes={data.notes.notes}
			total={data.notes.total}
			canAdd={canActOn(data.me, account.user)}
		/>
	{/if}

	{#if account.figures && data.comments && data.reports && data.against}
		<AccountLists
			comments={data.comments}
			reports={data.reports}
			against={data.against}
			figures={account.figures}
		/>
	{/if}

	<section class="timeline" aria-labelledby="timeline-heading">
		<h2 id="timeline-heading">Moderation log</h2>
		<PagedList
			page={data.timeline}
			queue="log"
			params="&account={encodeURIComponent(account.user.id)}"
			key={(entry) => entry.id}
			empty="No moderation actions on this account."
			noun="actions"
		>
			{#snippet row(entry)}
				<RecentActionRow {entry} me={data.me} />
			{/snippet}
		</PagedList>
	</section>
</div>

<style lang="postcss">
	@reference "../../../../../app.css";

	.page {
		@apply flex flex-col mx-auto;
		max-width: 48rem;
		gap: var(--spacing-md);
		padding-block: var(--spacing-xl);
	}

	.back {
		@apply inline-flex items-center text-sm text-ink-muted no-underline;
	}

	.back:hover {
		@apply text-ink;
	}

	.timeline {
		@apply flex flex-col;
		gap: var(--spacing-sm);
	}

	h2 {
		@apply text-lg font-semibold;
	}
</style>
