<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import Notice from '#lib/components/ui/notice.svelte';
	import ProfileComments from '#lib/components/user/profileComments.svelte';
	import ProfileEditor from '#lib/components/user/profileEditor.svelte';
	import ProfileHeader from '#lib/components/user/profileHeader.svelte';
	import ProfileNotPublic from '#lib/components/user/profileNotPublic.svelte';
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

	type Tab = 'comments' | 'reports' | 'notPublic';
	let tab = $state<Tab>('comments');
	/**
	 * The owner's third tab: what the public lists leave out. It exists only once the owner's view
	 * has loaded and holds something, so a visitor and an owner with nothing unpublished see two.
	 */
	const hasNotPublic = $derived(
		!!owned && owned.notPublic.comments.length + owned.notPublic.reports.length > 0
	);
	const TABS = $derived([
		{ id: 'comments' as const, label: 'Comments' },
		{ id: 'reports' as const, label: 'Community reports' },
		...(hasNotPublic ? [{ id: 'notPublic' as const, label: 'Not public' }] : [])
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

	/** The tab keyboard pattern: the arrow keys move between the tabs (and wrap), and the focused one is selected. */
	function onTabKeydown(event: KeyboardEvent) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const at = TABS.findIndex((t) => t.id === tab);
		const next =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? TABS.length - 1
					: (at + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
		tab = TABS[next].id;
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
		commentCount={profile.commentCount}
		reportCount={profile.reportCount}
		titleCount={profile.titleCount}
	>
		{#snippet actions()}
			{#if isOwner}
				{#if !editing}
					<button
						class="btn btn--ink"
						type="button"
						bind:this={editButton}
						onclick={() => (editing = true)}
						><i class="ri-edit-line" aria-hidden="true"></i><span class="btn-text"
							>Edit profile</span
						></button
					>
				{/if}
				<a class="btn btn--ghost" href="/user/settings"
					><i class="ri-settings-3-line" aria-hidden="true"></i><span class="btn-text"
						>Settings</span
					></a
				>
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
				aria-controls={tab === t.id ? `panel-${t.id}` : undefined}
				tabindex={tab === t.id ? 0 : -1}
				onclick={() => (tab = t.id)}
				onkeydown={onTabKeydown}
			>
				{t.label}
			</button>
		{/each}
	</div>

	<div class="card" id="panel-{tab}" role="tabpanel" aria-labelledby="tab-{tab}">
		{#if tab === 'comments'}
			{#key profile.id}
				<ProfileComments
					username={profile.username}
					first={profile.comments}
					own={owned ? { replyCounts: owned.replyCounts } : null}
				/>
			{/key}
		{:else if tab === 'reports'}
			{#key profile.id}
				<ProfileReports username={profile.username} first={profile.reports} />
			{/key}
		{:else if owned}
			<ProfileNotPublic items={owned.notPublic} />
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

	/*
	 * One row at every width, so the height is the chips' own: the third tab's arrival changes
	 * nothing below it. A phone too narrow for three scrolls the row sideways. The padding and
	 * the opposite margin keep the focus ring inside the scroller without moving the row.
	 */
	.tabs {
		@apply flex overflow-x-auto;
		gap: var(--spacing-sm);
		padding: 3px;
		/* The tabs label the card below them. */
		margin: -3px -3px calc(var(--spacing-md) - var(--spacing-lg) - 3px);
		scrollbar-width: thin;
	}

	.tabs .chip {
		flex: none;
	}

	.chip[aria-selected='true'] {
		border-color: var(--brand);
		color: var(--brand);
	}

	@media (pointer: coarse) {
		.chip {
			height: 2.75rem;
		}
	}

	/* The first row of a panel needs no hairline above it. */
	.card > :global(:first-child),
	.card > :global(:first-child > li:first-child) {
		border-top: 0;
	}
</style>
