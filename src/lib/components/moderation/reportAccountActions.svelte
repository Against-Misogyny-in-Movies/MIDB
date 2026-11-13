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
	}

	let { account, canAct, canRestrict }: Props = $props();

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
	const toggle = (next: Panel) => (panel = panel === next ? null : next);
</script>

{#if (canAct && account.reportCount > 0) || canRestrict}
	<div class="account" bind:this={root} tabindex="-1">
		<p class="label">Account</p>
		<div class="actions">
			{#if canAct && account.reportCount > 0}
				<button
					class="btn btn--ghost"
					type="button"
					aria-expanded={panel === 'rejectAll'}
					onclick={() => toggle('rejectAll')}>Reject all from this account</button
				>
			{/if}
			{#if canRestrict}
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

	.actions {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}
</style>
