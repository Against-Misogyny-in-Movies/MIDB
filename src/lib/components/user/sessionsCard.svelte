<script lang="ts">
	import { onMount } from 'svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import SkeletonRows from '#lib/components/ui/skeletonRows.svelte';
	import SettingsCard from '#lib/components/user/settingsCard.svelte';
	import SettingsPlate from '#lib/components/user/settingsPlate.svelte';
	import SettingsList from '#lib/components/user/settingsList.svelte';
	import SettingsRow from '#lib/components/user/settingsRow.svelte';
	import type { AccountSession } from '#lib/media/types/sessions.ts';
	import { UNKNOWN_DEVICE } from '#lib/media/utils/userAgent.ts';
	import { formatDate, formatTime } from '#lib/media/utils/format.ts';
	import { SESSION_COOKIE_CACHE_SECONDS } from '#lib/media/utils/sessionCache.ts';
	import {
		AccountSessions,
		OTHERS,
		SESSIONS_HEADING_ID
	} from '#lib/media/utils/sessions.svelte.js';

	interface Props {
		/** What the page's load counted: the card reserves that many rows while its list loads. */
		initialCount: number;
	}

	let { initialCount }: Props = $props();

	// The count only seeds the first paint; the list replaces it once loaded.
	// svelte-ignore state_referenced_locally
	const sessions = new AccountSessions(initialCount);

	const cacheMinutes = SESSION_COOKIE_CACHE_SECONDS / 60;
	const cacheLine = `A session that was signed out can keep working for up to ${cacheMinutes} ${cacheMinutes === 1 ? 'minute' : 'minutes'}.`;

	/** The start day in UTC like every date on the site, with the time when two rows share a name. */
	/** A phone, a computer, or a neutral device when the user agent could not be read. */
	function deviceIcon(session: AccountSession) {
		if (session.mobile) return 'ri-smartphone-line';
		return session.label === UNKNOWN_DEVICE ? 'ri-device-line' : 'ri-computer-line';
	}

	function since(value: string, withTime: boolean) {
		return `Since ${formatDate(value)}${withTime ? `, ${formatTime(value)}` : ''}`;
	}

	onMount(() => {
		void sessions.load();
	});
</script>

<SettingsCard
	id="sessions"
	headingId={SESSIONS_HEADING_ID}
	title="Sessions"
	busy={sessions.loading || sessions.busy}
>
	{#if sessions.loadFailed}
		<Notice tone="error">The sessions could not be loaded. Reload the page to try again.</Notice>
	{:else if sessions.loading}
		<!-- The current session is first and has no action, so it is one line at every width. -->
		<SkeletonRows
			rows={sessions.rowCount}
			label="Loading sessions"
			height="var(--row-height)"
			firstHeight="var(--row-line-height)"
		/>
	{:else}
		<SettingsList>
			{#each sessions.sessions as session (session.id)}
				<SettingsRow
					icon={deviceIcon(session)}
					name={session.label}
					detail={since(session.startedAt, sessions.duplicateLabels.includes(session.label))}
					plateOpen={sessions.confirming === session.id}
				>
					{#snippet badge()}
						{#if session.current}
							<Badge>This device</Badge>
						{/if}
					{/snippet}
					{#snippet actions()}
						{#if !session.current}
							<button
								type="button"
								id="sign-out-{session.id}"
								class="btn btn--ghost"
								disabled={sessions.busy}
								aria-label="Sign out {session.label}"
								onclick={() => sessions.openConfirm(session.id)}
							>
								Sign out
							</button>
						{/if}
					{/snippet}
					{#snippet plate()}
						<p id="confirm-session-{session.id}" tabindex="-1">
							Sign out {session.label}? It needs to sign in again.
						</p>
						<p>{cacheLine}</p>
						<div class="flex flex-wrap gap-sm">
							<button
								type="button"
								class="btn btn--ink"
								aria-busy={sessions.running === session.id}
								disabled={sessions.busy && sessions.running !== session.id}
								onclick={() => sessions.signOut(session)}>Sign out</button
							>
							<button
								type="button"
								class="btn btn--ghost"
								onclick={() => sessions.closePlate(`sign-out-${session.id}`)}>Cancel</button
							>
						</div>
					{/snippet}
				</SettingsRow>
			{/each}
		</SettingsList>
	{/if}

	{#if sessions.hasOthers}
		<div class="others">
			<div>
				<button
					type="button"
					id="sign-out-others"
					class="btn btn--ghost"
					disabled={sessions.loading || sessions.busy}
					onclick={() => sessions.openConfirm(OTHERS)}
				>
					Sign out everywhere else
				</button>
			</div>
			{#if sessions.confirming === OTHERS}
				<SettingsPlate>
					<p id="confirm-session-{OTHERS}" tabindex="-1">
						Sign out every other session? Each needs to sign in again.
					</p>
					<p>{cacheLine}</p>
					<div class="flex flex-wrap gap-sm">
						<button
							type="button"
							class="btn btn--ink"
							aria-busy={sessions.running === OTHERS}
							disabled={sessions.busy && sessions.running !== OTHERS}
							onclick={() => sessions.signOutOthers()}>Sign out everywhere else</button
						>
						<button
							type="button"
							class="btn btn--ghost"
							onclick={() => sessions.closePlate('sign-out-others')}>Cancel</button
						>
					</div>
				</SettingsPlate>
			{/if}
		</div>
	{/if}
</SettingsCard>

<style lang="postcss">
	@reference "../../../app.css";

	.others {
		@apply flex flex-col gap-sm;
		padding-top: var(--spacing-sm);
	}
</style>
