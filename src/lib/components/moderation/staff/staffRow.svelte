<script lang="ts">
	import AccountLink from '#lib/components/moderation/accountLink.svelte';
	import ModerationConfirm from '#lib/components/moderation/moderationConfirm.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import Avatar from '#lib/components/user/avatars/Avatar.svelte';
	import type { StaffMember } from '#lib/media/types/moderation.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';

	interface Props {
		member: StaffMember;
		/** The acting administrator's id: no one removes their own role here. */
		meId: string;
	}

	let { member, meId }: Props = $props();

	let busy = $state<string | null>(null);
	let confirming = $state(false);
	let trigger: HTMLButtonElement | undefined = $state();
	let root: HTMLElement | undefined = $state();
	/** The row leaves the list when its role goes, so the focus falls back to the form's field. */
	const submit = rowSubmit(
		() => root,
		(name) => (busy = name),
		() => (confirming = false),
		() => 'make-moderator-field'
	);

	const { user } = $derived(member);
	const removable = $derived(user.role === 'moderator' && user.id !== meId);
</script>

<li class="row" tabindex="-1" bind:this={root}>
	<span class="who">
		<Avatar avatarKey={user.avatarKey} size={24} />
		<strong><AccountLink id={user.id} username={user.username} name={user.displayName} /></strong>
		<Badge tone="brand">{user.role === 'moderator' ? 'Moderator' : 'Administrator'}</Badge>
		<span class="label"
			>{member.promoted ? 'Moderator since' : 'Joined'}
			<time datetime={member.since}>{formatDate(member.since)}</time></span
		>
	</span>
	{#if user.role === 'administrator'}
		<span class="label">Set with the seed script.</span>
	{:else if removable}
		<button
			class="btn btn--ghost"
			type="button"
			aria-expanded={confirming}
			bind:this={trigger}
			onclick={() => (confirming = !confirming)}
		>
			Remove moderator role
		</button>
	{/if}
	{#if confirming}
		<div class="plate-row">
			<ModerationConfirm
				kind="removeModerator"
				name={user.displayName}
				fields={{ userId: user.id }}
				{busy}
				{submit}
				oncancel={() => (confirming = false)}
				opener={() => trigger}
			/>
		</div>
	{/if}
</li>

<style lang="postcss">
	@reference "../../../../app.css";

	.row {
		@apply flex flex-wrap items-center justify-between;
		gap: var(--spacing-sm) var(--spacing-md);
		padding: var(--spacing-md) 20px;
		scroll-margin-top: 5rem;
	}

	/* The plate takes the row's full width under the name and the button. */
	.plate-row {
		@apply w-full;
	}

	.who {
		@apply inline-flex flex-wrap items-center;
		gap: var(--spacing-xs) var(--spacing-sm);
	}
</style>
