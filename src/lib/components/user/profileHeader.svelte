<script lang="ts">
	import type { Snippet } from 'svelte';
	import Avatar from '#lib/components/user/avatars/Avatar.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import { formatDate } from '#lib/media/utils/format.ts';

	interface Props {
		username: string;
		avatarKey: string | null;
		staffRole: 'moderator' | 'administrator' | null;
		/** `YYYY-MM-DD`. */
		joinedAt: string;
		scoreTotal: number;
		commentCount: number;
		/** Counted community reports. */
		reportCount: number;
		/** Distinct films and series the comments and counted reports are on. */
		titleCount: number;
		/** The owner's actions (Edit profile, Settings); absent for a visitor. */
		actions?: Snippet;
	}

	let {
		username,
		avatarKey,
		staffRole,
		joinedAt,
		scoreTotal,
		commentCount,
		reportCount,
		titleCount,
		actions
	}: Props = $props();

	const stats = $derived([
		{ name: 'Comment score', value: scoreTotal },
		{ name: 'Comments', value: commentCount },
		{ name: 'Community reports', value: reportCount },
		{ name: 'Films and series', value: titleCount }
	]);
</script>

<header class="profile-header">
	<div class="portrait"><Avatar {avatarKey} size={64} /></div>
	<div class="meta">
		<h1 class="display">{username}</h1>
		<dl class="facts">
			{#if staffRole}
				<div>
					<dt class="sr-only">Role</dt>
					<dd>
						<Badge tone="brand">{staffRole === 'moderator' ? 'Moderator' : 'Administrator'}</Badge>
					</dd>
				</div>
			{/if}
			<div>
				<dt class="label">Joined</dt>
				<dd><time datetime={joinedAt}>{formatDate(joinedAt)}</time></dd>
			</div>
		</dl>
	</div>
	<div class="actions">
		{#if actions}{@render actions()}{/if}
	</div>
	<dl class="stats">
		{#each stats as stat (stat.name)}
			<div>
				<dt class="label">{stat.name}</dt>
				<dd>{stat.value}</dd>
			</div>
		{/each}
	</dl>
</header>

<style lang="postcss">
	@reference "../../../app.css";

	/*
	 * Below 40rem the avatar and the owner's actions share the first row, which is the 64px
	 * avatar's height with or without the 44px buttons, and the name and facts take the full width
	 * beneath, so the actions arriving after the session loads change no height and re-wrap
	 * nothing. From 40rem it is one row with a fixed-width actions column reserved for everyone,
	 * wide enough for both buttons, so the name column is the same width before and after.
	 */
	.profile-header {
		@apply grid items-center;
		--actions-width: 14rem;
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-areas:
			'portrait actions'
			'meta meta'
			'stats stats';
		gap: var(--spacing-md);
	}

	.portrait {
		@apply flex;
		grid-area: portrait;
	}

	.meta {
		@apply flex flex-col min-w-0;
		grid-area: meta;
		gap: var(--spacing-xs);
	}

	@media (min-width: 40rem) {
		.profile-header {
			grid-template-columns: auto minmax(0, 1fr) var(--actions-width);
			grid-template-areas:
				'portrait meta actions'
				'stats stats stats';
		}
	}

	@media (max-width: 40rem) {
		.actions :global(.btn) {
			width: 2.75rem;
			height: 2.75rem;
			padding: 0;
		}

		.actions :global(.btn-text) {
			@apply sr-only;
		}
	}

	@media (min-width: 40rem) {
		.actions :global(.btn i) {
			display: none;
		}
	}

	h1 {
		overflow-wrap: anywhere;
		font-size: 1.875rem;
	}

	.facts {
		@apply flex flex-wrap items-center m-0 text-sm;
		gap: var(--spacing-xs) var(--spacing-md);
	}

	.facts div {
		@apply flex items-center whitespace-nowrap;
		gap: var(--spacing-xs);
	}

	.facts dd {
		@apply m-0;
	}

	/*
	 * The four figures sit on their own row under the avatar row: two columns on a phone, four
	 * from 40rem. Line heights fix every dimension, so a larger number moves nothing.
	 */
	.stats {
		@apply grid m-0;
		grid-area: stats;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--spacing-md);
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--border);
	}

	@media (min-width: 40rem) {
		.stats {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	.stats div {
		@apply min-w-0;
	}

	.stats dt {
		@apply whitespace-nowrap overflow-hidden text-ellipsis;
		line-height: 1.25rem;
	}

	.stats dd {
		@apply m-0 text-ink font-semibold;
		font-size: 1.5rem;
		line-height: 2rem;
		font-variant-numeric: tabular-nums;
	}

	.actions {
		@apply flex justify-end;
		grid-area: actions;
		gap: var(--spacing-sm);
	}
</style>
