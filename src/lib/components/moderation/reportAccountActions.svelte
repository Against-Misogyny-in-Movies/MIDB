<script lang="ts">
	import { enhance } from '$app/forms';
	import Notice from '#lib/components/ui/notice.svelte';
	import type { ActionOutcome, ReportAccount } from '#lib/media/types/moderation.ts';
	import { MODERATION_REASON_MAX, MUTE_HOURS } from '#lib/media/utils/comments.ts';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';

	interface Props {
		account: ReportAccount;
		outcome: ActionOutcome;
		/** Whether the reports of the account can still be rejected. */
		canRejectAll: boolean;
	}

	let { account, outcome, canRejectAll }: Props = $props();

	type Panel = 'mute' | 'ban';
	let panel = $state<Panel | null>(null);
	let busy = $state<string | null>(null);
	let root: HTMLElement | undefined = $state();
	const submit = rowSubmit(
		() => root,
		(name) => (busy = name),
		() => (panel = null)
	);

	const name = $derived(account.username ?? 'this account');
	const mine = $derived(outcome?.id === account.userId ? outcome : null);
	const toggle = (next: Panel) => (panel = panel === next ? null : next);
	const DONE: Record<string, string> = {
		rejectAccountReports: 'Every report of the account is rejected.',
		mute: 'Account muted.',
		ban: 'Account banned.'
	};
</script>

<div class="account" bind:this={root} tabindex="-1">
	<div class="actions">
		{#if canRejectAll}
			<form
				method="POST"
				action="?/rejectAccountReports"
				use:enhance={submit('rejectAccountReports')}
			>
				<input type="hidden" name="userId" value={account.userId} />
				<button class="btn btn--ghost" disabled={busy !== null}>
					{busy === 'rejectAccountReports' ? 'Rejecting…' : 'Reject all from this account'}
				</button>
			</form>
		{/if}
		<button
			class="btn btn--ghost"
			type="button"
			aria-expanded={panel === 'mute'}
			onclick={() => toggle('mute')}>Mute account</button
		>
		<button
			class="btn btn--ghost"
			type="button"
			aria-expanded={panel === 'ban'}
			onclick={() => toggle('ban')}>Ban account</button
		>
	</div>

	{#if panel}
		<form class="plate panel" method="POST" action="?/{panel}" use:enhance={submit(panel)}>
			<input type="hidden" name="userId" value={account.userId} />
			<p class="text-sm">
				{#if panel === 'mute'}
					Mute {name}? The account cannot write, edit, delete, vote on or report comments until the
					mute ends, and its reader reports leave the counts.
				{:else}
					Ban {name}? Its sessions end, it cannot sign in again, its reader reports leave the
					counts, and this page has no way to undo a ban.
				{/if}
			</p>
			{#if panel === 'mute'}
				<label class="field">
					<span class="label">Length</span>
					<select name="hours" class="input">
						{#each MUTE_HOURS as hours (hours)}
							<option value={hours}>{hours === 24 ? '1 day' : `${hours / 24} days`}</option>
						{/each}
					</select>
				</label>
			{/if}
			<label class="field">
				<span class="label">Reason, kept in the log (optional)</span>
				<input class="input" name="reason" maxlength={MODERATION_REASON_MAX} autocomplete="off" />
			</label>
			<div class="actions">
				<button class="btn btn--ink" disabled={busy !== null}>
					{busy === panel ? 'Working…' : panel === 'mute' ? 'Mute account' : 'Ban account'}
				</button>
				<button class="btn btn--ghost" type="button" onclick={() => (panel = null)}>Cancel</button>
			</div>
		</form>
	{/if}

	{#if mine?.error}
		<Notice tone="error">{mine.error}</Notice>
	{:else if mine?.done && DONE[mine.done]}
		<Notice tone="success">{DONE[mine.done]}</Notice>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.account {
		@apply flex flex-col;
		gap: var(--spacing-sm);
	}

	.actions {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}

	.panel {
		@apply flex flex-col;
		gap: var(--spacing-sm);
	}

	.field {
		@apply flex flex-col;
		gap: var(--spacing-xs);
	}
</style>
