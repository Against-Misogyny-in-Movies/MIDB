<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import Notice from '#lib/components/ui/notice.svelte';
	import OwnComments from '#lib/components/user/ownComments.svelte';
	import OwnReports from '#lib/components/user/ownReports.svelte';
	import ProfileComments from '#lib/components/user/profileComments.svelte';
	import ProfileEditor from '#lib/components/user/profileEditor.svelte';
	import ProfileHeader from '#lib/components/user/profileHeader.svelte';
	import ProfileReports from '#lib/components/user/profileReports.svelte';
	import type { PublicUser } from '#lib/media/types/user.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { OwnProfileState } from '#lib/media/utils/ownProfile.svelte.js';
	import { profileHref } from '#lib/media/utils/profileHref.ts';
	import { session } from '#lib/media/utils/session.svelte.js';

	let { data }: { data: PageData } = $props();

	const profile = $derived(data.profile);

	/**
	 * The cached page is the same for everyone. Once the client session says the reader owns it,
	 * the owner's actions show and their private view loads (`/api/me/profile`).
	 */
	const isOwner = $derived(session.status === 'user' && session.user?.id === profile.id);
	const own = new OwnProfileState();
	/** The owner's view, once it has loaded; until then the owner sees what a visitor sees. */
	const owned = $derived(isOwner && own.phase === 'ready' ? own.data : null);

	/** A save that kept the address: the header shows it until the cached page catches up. */
	let saved = $state<PublicUser | null>(null);
	const avatarKey = $derived(saved?.id === profile.id ? saved.avatarKey : profile.avatarKey);
	let editing = $state(false);

	type Tab = 'comments' | 'reports';
	let tab = $state<Tab>('comments');
	const TABS = $derived([
		{
			id: 'comments' as const,
			label: 'Comments',
			count: owned ? owned.comments.length : profile.commentCount
		},
		{
			id: 'reports' as const,
			label: 'Community reports',
			count: owned ? owned.reports.length : profile.reports.length
		}
	]);

	/** `#reports` opens the reports tab (a link from a title page, or `/user/metrics`). */
	function tabFromHash() {
		if (location.hash === '#reports') tab = 'reports';
		else if (location.hash === '#comments') tab = 'comments';
	}

	onMount(() => {
		void session.load();
		tabFromHash();
	});

	$effect(() => {
		if (isOwner && untrack(() => own.phase) === 'idle') void own.load();
	});

	/** The tab keyboard pattern: the arrow keys move between the two tabs, and the focused one is selected. */
	function onTabKeydown(event: KeyboardEvent) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		tab =
			event.key === 'Home'
				? 'comments'
				: event.key === 'End'
					? 'reports'
					: tab === 'comments'
						? 'reports'
						: 'comments';
		void focusAfterUpdate(() => document.getElementById(`tab-${tab}`));
	}

	let editButton: HTMLButtonElement | undefined = $state();

	function closeEditor() {
		editing = false;
		void focusAfterUpdate(() => editButton);
	}

	/** A rename moves the profile to its new address; an avatar change shows at once. */
	async function onsaved(me: PublicUser) {
		session.set(me);
		editing = false;
		if (me.username && me.username !== profile.username) {
			await goto(profileHref(me.username) ?? '/user/profile', { replaceState: true });
		} else {
			saved = me;
		}
		await focusAfterUpdate(() => editButton);
	}
</script>

<svelte:head>
	<title>{profile.username} · MIDB</title>
</svelte:head>

<svelte:window onhashchange={tabFromHash} />

<div class="profile-page">
	<ProfileHeader
		username={profile.username}
		{avatarKey}
		staffRole={profile.staffRole}
		joinedAt={profile.joinedAt}
		scoreTotal={profile.scoreTotal}
	>
		{#snippet actions()}
			{#if isOwner && !editing}
				<button
					class="btn btn--ink"
					type="button"
					bind:this={editButton}
					onclick={() => (editing = true)}>Edit profile</button
				>
				<a class="btn btn--ghost" href="/user/settings">Settings</a>
			{/if}
		{/snippet}
	</ProfileHeader>

	{#if editing && isOwner && session.user}
		<ProfileEditor user={session.user} {onsaved} oncancel={closeEditor} />
	{/if}

	{#if owned?.mutedUntil}
		<Notice tone="warn">
			This account is muted until {formatDate(owned.mutedUntil)}: it cannot write, edit, delete,
			vote on or report comments, and none of its community reports count.
		</Notice>
	{/if}
	{#if isOwner && own.phase === 'error'}
		<Notice tone="error">
			Comments that are not published and community reports that do not count could not be loaded.
			Reload the page to try again.
		</Notice>
	{/if}

	<div class="tabs" role="tablist" aria-label="Activity">
		{#each TABS as t (t.id)}
			<button
				class="chip"
				type="button"
				role="tab"
				id="tab-{t.id}"
				aria-selected={tab === t.id}
				aria-controls="panel-{t.id}"
				tabindex={tab === t.id ? 0 : -1}
				onclick={() => (tab = t.id)}
				onkeydown={onTabKeydown}
			>
				{t.label} <span class="count">{t.count}</span>
			</button>
		{/each}
	</div>

	<div
		class="card"
		id="panel-{tab}"
		role="tabpanel"
		aria-labelledby="tab-{tab}"
		aria-busy={isOwner && own.phase === 'loading'}
	>
		{#if tab === 'comments'}
			{#if owned}
				<OwnComments comments={owned.comments} />
			{:else}
				{#key profile.id}
					<ProfileComments username={profile.username} first={profile.comments} />
				{/key}
			{/if}
		{:else if owned}
			<OwnReports reports={owned.reports} />
		{:else}
			<ProfileReports reports={profile.reports} />
		{/if}
	</div>
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.profile-page {
		@apply flex flex-col mx-auto;
		max-width: 42rem;
		gap: var(--spacing-lg);
		padding-block: var(--spacing-xl);
	}

	.tabs {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
		/* The tabs label the card below them. */
		margin-bottom: calc(var(--spacing-md) - var(--spacing-lg));
	}

	.chip[aria-selected='true'] {
		border-color: var(--brand);
		color: var(--brand);
	}

	.count {
		font-variant-numeric: tabular-nums;
	}

	@media (pointer: coarse) {
		.chip {
			height: 2.75rem;
		}
	}

	.card {
		@apply overflow-hidden;
	}

	/* The first row of a panel needs no hairline above it. */
	.card > :global(:first-child),
	.card > :global(:first-child > li:first-child) {
		border-top: 0;
	}
</style>
