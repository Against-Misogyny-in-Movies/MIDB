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
		/** The owner's actions (Edit profile, Settings); absent for a visitor. */
		actions?: Snippet;
	}

	let { username, avatarKey, staffRole, joinedAt, scoreTotal, actions }: Props = $props();
</script>

<header class="profile-header">
	<Avatar {avatarKey} size={64} />
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
			<div>
				<dt class="label">Comment score</dt>
				<dd class="num">{scoreTotal}</dd>
			</div>
		</dl>
	</div>
	<div class="actions">
		{#if actions}{@render actions()}{/if}
	</div>
</header>

<style lang="postcss">
	@reference "../../../app.css";

	/*
	 * Avatar, name and the owner's actions share one row at every width, so the actions arriving
	 * after the session loads change no height: on a phone they are icon buttons.
	 */
	.profile-header {
		@apply grid items-center;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: var(--spacing-md);
	}

	.meta {
		@apply flex flex-col min-w-0;
		gap: var(--spacing-xs);
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

	.actions {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}

	.actions:empty {
		display: none;
	}
</style>
