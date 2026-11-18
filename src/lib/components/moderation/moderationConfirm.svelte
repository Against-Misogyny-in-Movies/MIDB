<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import type { ModerationRule } from '#lib/media/types/comments.ts';
	import {
		MODERATION_REASON_MAX,
		MODERATION_RULE_LABELS,
		MUTE_HOURS,
		formatMuteHours,
		moderationRule
	} from '#lib/media/utils/comments.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import type { rowSubmit } from '#lib/media/utils/rowSubmit.ts';

	type Kind =
		| 'hide'
		| 'reject'
		| 'mute'
		| 'ban'
		| 'unmute'
		| 'unban'
		| 'rejectAll'
		| 'removeModerator';

	interface Props {
		kind: Kind;
		/** The account's name, for the mute, ban, reject-all and role sentences. */
		name: string;
		/** Hidden inputs the action reads (the comment's id, the account's id); a list repeats the input. */
		fields: Record<string, string | string[]>;
		/** The account's community reports that are not rejected, for `rejectAll`. */
		reportCount?: number;
		/** The form action when it is not the kind's own (`bulk`); `fields` then name the operation. */
		action?: string;
		/** For `hide` and `reject`: the comments the action covers, when it covers a selection. */
		count?: number;
		busy: string | null;
		submit: ReturnType<typeof rowSubmit>;
		oncancel: () => void;
		/** The control that opened the plate: Cancel and Escape put the focus back on it. */
		opener?: () => HTMLElement | null | undefined;
	}

	let {
		kind,
		name,
		fields,
		reportCount = 0,
		action,
		count,
		busy,
		submit,
		oncancel,
		opener
	}: Props = $props();

	const ACTIONS: Record<Kind, string> = {
		hide: 'hide',
		reject: 'reject',
		mute: 'mute',
		ban: 'ban',
		unmute: 'unmute',
		unban: 'unban',
		rejectAll: 'rejectAccountReports',
		removeModerator: 'removeModerator'
	};
	const BUTTONS: Record<Kind, string> = {
		hide: 'Hide comment',
		reject: 'Reject comment',
		mute: 'Mute account',
		ban: 'Ban account',
		unmute: 'End mute',
		unban: 'Lift ban',
		rejectAll: 'Reject all community reports',
		removeModerator: 'Remove moderator role'
	};
	const noun = $derived(count === 1 ? 'comment' : 'comments');
	const button = $derived(
		count === undefined
			? BUTTONS[kind]
			: `${BUTTONS[kind].replace(' comment', '')} ${count} ${noun}`
	);
	const shownToAuthor = $derived(kind === 'hide' || kind === 'reject');
	/** A hide, a reject, a mute and a ban name the rule behind them. */
	const needsRule = $derived(
		kind === 'hide' || kind === 'reject' || kind === 'mute' || kind === 'ban'
	);
	/** Only these kinds log a note: a rejected report and a role change have none. */
	const hasNote = $derived(kind !== 'rejectAll' && kind !== 'removeModerator');
	let rule = $state<ModerationRule | null>(null);
	/** Set when the plate is sent without a rule; the message stays until one is chosen. */
	let ruleMissing = $state(false);
	let form: HTMLFormElement | undefined = $state();

	/**
	 * A plate that needs a rule refuses to send without one: it says so and puts the focus on the
	 * list. It stops the event before the form's `enhance` handler sees it.
	 */
	function onsubmit(event: SubmitEvent) {
		if (!needsRule || rule !== null) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		ruleMissing = true;
		form?.querySelector<HTMLInputElement>('input[name="rule"]')?.focus();
	}

	/** The plate takes the focus on open: its first field, or its button when it has none. */
	onMount(() => {
		form
			?.querySelector<HTMLElement>('select, input:not([type="hidden"]), button:not(:disabled)')
			?.focus();
	});

	function close() {
		// Read before `oncancel`, which clears the state the opener is looked up by.
		const target = opener?.();
		oncancel();
		void focusAfterUpdate(() => target);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		event.stopPropagation();
		close();
	}
</script>

<!-- Escape closes the plate from any of its fields; the form itself is not interactive. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
	class="plate panel"
	method="POST"
	action="?/{action ?? ACTIONS[kind]}"
	use:enhance={submit(kind)}
	bind:this={form}
	{onkeydown}
	{onsubmit}
>
	{#each Object.entries(fields) as [field, value] (field)}
		{#each [value].flat() as one (one)}
			<input type="hidden" name={field} value={one} />
		{/each}
	{/each}
	<p class="text-sm">
		{#if count !== undefined && kind === 'hide'}
			Hide {count} selected {noun}? A pending or published one is taken out of view, its replies
			stay under a placeholder, and its author sees it as hidden, with the rule and the note. A
			comment in any other status stays as it is.
		{:else if count !== undefined && kind === 'reject'}
			Reject {count} selected {noun}? A pending or published one is taken out of view, and its
			author sees it as rejected, with the rule and the note. A comment in any other status stays as
			it is.
		{:else if kind === 'hide'}
			Hide this comment? It leaves the public list, and replies stay under a placeholder. The author
			sees it as hidden, with the rule and the note.
		{:else if kind === 'reject'}
			Reject this comment? It leaves the public list, and the author sees it as rejected, with the
			rule and the note.
		{:else if kind === 'mute'}
			Mute {name}? Until the mute ends, the account cannot write, edit, delete, vote on or report
			comments, and its community reports leave the counts.
		{:else if kind === 'ban'}
			Ban {name}? Its sessions end, it cannot sign in, its community reports leave the counts, its
			comment votes are removed and its published and pending comments are hidden. Only an
			administrator can lift a ban, and lifting it does not bring those back.
		{:else if kind === 'unmute'}
			End the mute on {name}? The account can write, edit, delete, vote on and report comments
			again, and its community reports count again.
		{:else if kind === 'unban'}
			Lift the ban on {name}? The account can sign in again and its community reports count again.
			The comments the ban hid stay hidden and its removed votes stay removed. A moderator can
			restore them one by one or in bulk.
		{:else if kind === 'removeModerator'}
			Remove the moderator role from {name}? The account loses the moderation pages at once.
		{:else if reportCount === 1}
			Reject the community report from {name}? It leaves the counts of the title it covers.
		{:else}
			Reject all {reportCount} community reports from {name}? They leave the counts on every title
			they cover.
		{/if}
	</p>
	{#if kind === 'mute'}
		<label class="field">
			<span class="label">Length</span>
			<select name="hours" class="input">
				{#each MUTE_HOURS as hours (hours)}
					<option value={hours}>{formatMuteHours(hours)}</option>
				{/each}
			</select>
		</label>
	{/if}
	{#if needsRule}
		<fieldset class="rules">
			<legend class="label">Rule</legend>
			{#each moderationRule as value (value)}
				<label class="check-row">
					<input
						type="radio"
						name="rule"
						{value}
						bind:group={rule}
						onchange={() => (ruleMissing = false)}
					/>
					{MODERATION_RULE_LABELS[value]}
				</label>
			{/each}
			{#if ruleMissing}
				<p class="missing text-sm" role="alert">Choose a rule.</p>
			{/if}
		</fieldset>
	{/if}
	{#if hasNote}
		<label class="field">
			<span class="label">
				{shownToAuthor
					? 'Note, shown to the author (optional)'
					: 'Note, kept in the log (optional)'}
			</span>
			<input class="input" name="reason" maxlength={MODERATION_REASON_MAX} autocomplete="off" />
		</label>
	{/if}
	<div class="action-row">
		<button
			class="btn btn--ink"
			aria-busy={busy === kind}
			disabled={busy !== null && busy !== kind}
		>
			{button}
		</button>
		<button class="btn btn--ghost" type="button" onclick={close}>Cancel</button>
	</div>
</form>

<style lang="postcss">
	@reference "../../../app.css";

	.panel {
		@apply flex flex-col;
		gap: var(--spacing-sm);
	}

	.field {
		@apply flex flex-col;
		gap: var(--spacing-xs);
	}

	.rules {
		@apply grid;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		gap: var(--spacing-xs) var(--spacing-md);
		border: 0;
		margin: 0;
		padding: 0;
	}

	.missing {
		grid-column: 1 / -1;
		color: var(--danger);
	}

	.rules legend {
		@apply w-full;
		grid-column: 1 / -1;
		margin-bottom: var(--spacing-xs);
	}
</style>
