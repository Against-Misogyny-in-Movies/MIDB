<script lang="ts">
	import ModerationConfirm from '#lib/components/moderation/moderationConfirm.svelte';
	import type { ReportAccount } from '#lib/media/types/moderation.ts';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';

	interface Props {
		account: ReportAccount;
		/** False for an account the acting staff member cannot reject reports of (`canActOn`). */
		canAct: boolean;
		/** False for an account they cannot mute or ban (`canActOn` with `restrict`). */
		canRestrict: boolean;
		/** The acting staff member's role: an administrator lifts any ban and ends any mute, a moderator only a mute a moderator set. */
		staffRole: string;
	}

	let { account, canAct, canRestrict, staffRole }: Props = $props();

	type Panel = 'mute' | 'ban' | 'unmute' | 'unban' | 'rejectAll';
	let panel = $state<Panel | null>(null);
	let busy = $state<string | null>(null);
	let root: HTMLElement | undefined = $state();
	let triggers = $state<Partial<Record<Panel, HTMLButtonElement>>>({});
	const submit = rowSubmit(
		() => root,
		(name) => (busy = name),
		() => (panel = null)
	);

	const name = $derived(account.username ?? 'this account');
	const canEndMute = $derived(staffRole === 'administrator' || account.mutedByModerator);
	const canLiftBan = $derived(staffRole === 'administrator');
	const toggle = (next: Panel) => (panel = panel === next ? null : next);
</script>

{#if (canAct && account.reportCount > 0) || canRestrict}
	<div class="account" bind:this={root} tabindex="-1">
		<p class="label">Account</p>
		<div class="action-row">
			{#if canAct && account.reportCount > 0}
				<button
					class="btn btn--ghost"
					type="button"
					aria-expanded={panel === 'rejectAll'}
					bind:this={triggers.rejectAll}
					onclick={() => toggle('rejectAll')}>Reject all from this account</button
				>
			{/if}
			{#if canRestrict}
				{#if account.restricted === 'banned'}
					{#if canLiftBan}
						<button
							class="btn btn--ghost"
							type="button"
							aria-expanded={panel === 'unban'}
							bind:this={triggers.unban}
							onclick={() => toggle('unban')}>Lift ban</button
						>
					{/if}
				{:else}
					{#if account.restricted === 'muted'}
						{#if canEndMute}
							<button
								class="btn btn--ghost"
								type="button"
								aria-expanded={panel === 'unmute'}
								bind:this={triggers.unmute}
								onclick={() => toggle('unmute')}>End mute</button
							>
						{/if}
					{:else}
						<button
							class="btn btn--ghost"
							type="button"
							aria-expanded={panel === 'mute'}
							bind:this={triggers.mute}
							onclick={() => toggle('mute')}>Mute account</button
						>
					{/if}
					<button
						class="btn btn--ghost"
						type="button"
						aria-expanded={panel === 'ban'}
						bind:this={triggers.ban}
						onclick={() => toggle('ban')}>Ban account</button
					>
				{/if}
			{/if}
		</div>

		{#if panel}
			<ModerationConfirm
				kind={panel}
				{name}
				fields={{ userId: account.userId }}
				reportCount={account.reportCount}
				{busy}
				{submit}
				oncancel={() => (panel = null)}
				opener={() => (panel ? triggers[panel] : undefined)}
			/>
		{/if}
	</div>
{/if}

<style lang="postcss">
	@reference "../../../app.css";

	.account {
		@apply flex flex-col;
		gap: var(--spacing-sm);
		border-top: 1px solid var(--border);
		padding-top: var(--spacing-sm);
	}
</style>
