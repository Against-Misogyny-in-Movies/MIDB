<script lang="ts">
	import type { PageData } from './$types';
	import Avatar from '#lib/components/user/avatars/Avatar.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import ProfileComments from '#lib/components/user/profileComments.svelte';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { titleHref } from '#lib/media/utils/titleHref.ts';

	let { data }: { data: PageData } = $props();

	const profile = $derived(data.profile);
</script>

<svelte:head>
	<title>{profile.username} · MIDB</title>
</svelte:head>

<div class="profile-page">
	<header class="profile-header">
		<Avatar avatarKey={profile.avatarKey} size={64} />
		<div class="profile-meta">
			<h1 class="display">{profile.username}</h1>
			<dl class="facts">
				{#if profile.staffRole}
					<div>
						<dt class="sr-only">Role</dt>
						<dd>
							<Badge tone="brand">
								{profile.staffRole === 'moderator' ? 'Moderator' : 'Administrator'}
							</Badge>
						</dd>
					</div>
				{/if}
				<div>
					<dt class="label">Joined</dt>
					<dd><time datetime={profile.joinedAt}>{formatDate(profile.joinedAt)}</time></dd>
				</div>
				<div>
					<dt class="label">Comment score</dt>
					<dd class="num">{profile.scoreTotal}</dd>
				</div>
			</dl>
		</div>
	</header>

	<section class="card" aria-labelledby="comments-heading">
		<h2 id="comments-heading">Comments</h2>
		{#key profile.id}
			<ProfileComments username={profile.username} first={profile.comments} />
		{/key}
	</section>

	<section class="card" aria-labelledby="reports-heading">
		<h2 id="reports-heading">Counted community reports</h2>
		{#if profile.reports.length === 0}
			<p class="empty">No counted community reports.</p>
		{:else}
			<ul class="rows">
				{#each profile.reports as report (`${report.kind}:${report.tmdbId}:${report.name}`)}
					{@const href = titleHref(report.kind, report.tmdbId)}
					<li>
						{#if href}<a class="link title" {href}>{report.name}</a>{:else}<span class="title"
								>{report.name}</span
							>{/if}
						<time class="label" datetime={report.updatedAt}>
							Updated {formatDate(report.updatedAt)}
						</time>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.profile-page {
		@apply flex flex-col mx-auto;
		max-width: 42rem;
		gap: var(--spacing-lg);
		padding-block: var(--spacing-xl);
	}

	.profile-header {
		@apply flex items-center gap-md;
	}

	.profile-meta {
		@apply flex flex-col min-w-0;
		gap: var(--spacing-xs);
	}

	h1 {
		@apply truncate;
		font-size: 1.875rem;
	}

	.facts {
		@apply flex flex-wrap items-center m-0 text-sm;
		gap: var(--spacing-xs) var(--spacing-md);
	}

	.facts div {
		@apply flex items-center;
		gap: var(--spacing-xs);
	}

	.facts dd {
		@apply m-0;
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	.card {
		@apply overflow-hidden;
	}

	h2 {
		@apply font-semibold;
		font-size: 1.125rem;
		padding: var(--spacing-md) 20px;
	}

	.rows {
		@apply flex flex-col list-none m-0 p-0;
	}

	.rows li {
		@apply flex flex-wrap items-center justify-between;
		gap: var(--spacing-xs) var(--spacing-md);
		padding: var(--spacing-sm) 20px;
		border-top: 1px solid var(--border);
	}

	.title {
		@apply font-semibold;
	}

	.empty {
		@apply text-ink-muted;
		padding: var(--spacing-md) 20px;
		border-top: 1px solid var(--border);
	}
</style>
