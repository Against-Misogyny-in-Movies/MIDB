<script lang="ts">
	import Avatar from '#lib/components/user/avatars/Avatar.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import ReportAccountActions from '#lib/components/moderation/reportAccountActions.svelte';
	import type { AccountView, ReportAccount } from '#lib/media/types/moderation.ts';
	import { canActOn } from '#lib/media/utils/canActOn.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { recordLine } from '#lib/media/utils/reporterRecord.ts';

	interface Props {
		account: AccountView;
		/** The acting staff member: their role decides which of the account's actions show. */
		me: { id: string; role: string };
	}

	let { account, me }: Props = $props();

	const { user } = $derived(account);
	const figures = $derived(account.figures);

	/** What the shared account actions read: the standing and the count that Reject all would cover. */
	const actionable = $derived<ReportAccount>({
		userId: user.id,
		username: user.username,
		createdAt: account.joinedAt,
		reportCount: figures?.communityReportsLive ?? 0,
		commentCount: figures?.comments ?? 0,
		role: user.role,
		countsFrom: account.joinedAt,
		restricted: account.banned ? 'banned' : account.mutedUntil ? 'muted' : null,
		mutedByModerator: account.mutedByModerator
	});
	const canAct = $derived(canActOn(me, user));
	const canRestrict = $derived(canActOn(me, user, 'restrict'));

	const FIGURES = $derived(
		figures
			? [
					{ name: 'Comments', value: `${figures.comments}` },
					{ name: 'Hidden or rejected', value: `${figures.hiddenOrRejected}` },
					{ name: 'Open reports against', value: `${figures.openReportsAgainst}` },
					{ name: 'Community reports', value: `${figures.communityReports}` },
					{
						name: 'Comment reports made',
						value: `${figures.reportsMade.total}`,
						note: figures.reportsMade.total > 0 ? recordLine(figures.reportsMade) : null
					}
				]
			: []
	);
</script>

<section class="card summary" aria-labelledby="account-name">
	<header>
		<span class="avatar"><Avatar avatarKey={user.avatarKey} size={48} /></span>
		<div class="who">
			<h1 class="display" id="account-name">
				{account.deleted ? 'Deleted account' : user.displayName}
			</h1>
			<p class="facts">
				{#if user.role !== 'user'}
					<Badge tone="brand">{user.role === 'moderator' ? 'Moderator' : 'Administrator'}</Badge>
				{/if}
				{#if account.deleted}
					<Badge tone="neutral">Deleted</Badge>
				{:else if account.banned}
					<Badge tone="neg">Banned</Badge>
				{:else if account.mutedUntil}
					<Badge tone="mid">Muted until {formatDate(account.mutedUntil)}</Badge>
				{/if}
				<span class="label">Joined</span>
				<time class="label" datetime={account.joinedAt}>{formatDate(account.joinedAt)}</time>
			</p>
		</div>
	</header>

	{#if account.banned}
		<p class="label">
			Banned on {formatDate(account.banned.at)}{account.banned.reason
				? `. Note: ${account.banned.reason}`
				: ''}
		</p>
	{/if}

	{#if figures}
		<dl class="figures">
			{#each FIGURES as { name, value, note } (name)}
				<div>
					<dt class="label">{name}</dt>
					<dd>
						<span class="num">{value}</span>
						{#if note}<span class="label">{note}</span>{/if}
					</dd>
				</div>
			{/each}
		</dl>
		<ReportAccountActions account={actionable} {canAct} {canRestrict} {me} />
	{:else}
		<p class="label">
			This account was deleted. Its notes and reports are gone, and its comments are removed or
			emptied of text; its moderation log remains.
		</p>
	{/if}
</section>

<style lang="postcss">
	@reference "../../../../app.css";

	.summary {
		@apply flex flex-col;
		gap: var(--spacing-md);
		padding: var(--spacing-md) 20px;
	}

	header {
		@apply flex items-center;
		gap: var(--spacing-md);
	}

	.avatar {
		@apply flex shrink-0;
	}

	.who {
		@apply flex flex-col min-w-0;
		gap: var(--spacing-xs);
	}

	h1 {
		font-size: 1.875rem;
		overflow-wrap: anywhere;
	}

	.facts {
		@apply flex flex-wrap items-center;
		gap: var(--spacing-xs) var(--spacing-sm);
	}

	.figures {
		@apply grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: var(--spacing-md);
		margin: 0;
	}

	.figures dd {
		@apply flex flex-col;
		margin: 0;
	}

	.num {
		@apply text-lg font-semibold tabular-nums;
	}
</style>
