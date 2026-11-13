<script lang="ts">
	import ModerationConfirm from '#lib/components/moderation/moderationConfirm.svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import type { ActionOutcome, ReportAccount } from '#lib/media/types/moderation.ts';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';

	interface Props {
		account: ReportAccount;
		outcome: ActionOutcome;
		/** False for an account the acting moderator cannot mute, ban or reject (`canActOn`). */
		canAct: boolean;
	}

	let { account, outcome, canAct }: Props = $props();

	type Panel = 'mute' | 'ban' | 'rejectAll';
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
		rejectAccountReports: 'Every reader report of the account is rejected.',
		mute: 'Account muted.',
		ban: 'Account banned.'
	};
</script>

{#if canAct}
	<div class="account" bind:this={root} tabindex="-1">
		<p class="label">Account</p>
		<div class="actions">
			{#if account.reportCount > 0}
				<button
					class="btn btn--ghost"
					type="button"
					aria-expanded={panel === 'rejectAll'}
					onclick={() => toggle('rejectAll')}>Reject all from this account</button
				>
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
			<ModerationConfirm
				kind={panel}
				{name}
				fields={{ userId: account.userId }}
				reportCount={account.reportCount}
				{busy}
				{submit}
				oncancel={() => (panel = null)}
			/>
		{/if}

		{#if mine?.error}
			<Notice tone="error">{mine.error}</Notice>
		{:else if mine?.done && DONE[mine.done]}
			<Notice tone="success">{DONE[mine.done]}</Notice>
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

	.actions {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}
</style>
