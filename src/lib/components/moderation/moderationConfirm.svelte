<script lang="ts">
	import { enhance } from '$app/forms';
	import { MODERATION_REASON_MAX, MUTE_HOURS, formatMuteHours } from '#lib/media/utils/comments.ts';
	import type { rowSubmit } from '#lib/media/utils/rowSubmit.ts';

	type Kind = 'hide' | 'reject' | 'mute' | 'ban' | 'rejectAll';

	interface Props {
		kind: Kind;
		/** The account's name, for the mute, ban and reject-all sentences. */
		name: string;
		/** Hidden inputs the action reads (the comment's id, the account's id). */
		fields: Record<string, string>;
		/** The account's community reports that are not rejected, for `rejectAll`. */
		reportCount?: number;
		busy: string | null;
		submit: ReturnType<typeof rowSubmit>;
		oncancel: () => void;
	}

	let { kind, name, fields, reportCount = 0, busy, submit, oncancel }: Props = $props();

	const ACTIONS: Record<Kind, string> = {
		hide: 'hide',
		reject: 'reject',
		mute: 'mute',
		ban: 'ban',
		rejectAll: 'rejectAccountReports'
	};
	const BUTTONS: Record<Kind, string> = {
		hide: 'Hide comment',
		reject: 'Reject comment',
		mute: 'Mute account',
		ban: 'Ban account',
		rejectAll: 'Reject all community reports'
	};
	const shownToAuthor = $derived(kind === 'hide' || kind === 'reject');
</script>

<form class="plate panel" method="POST" action="?/{ACTIONS[kind]}" use:enhance={submit(kind)}>
	{#each Object.entries(fields) as [field, value] (field)}
		<input type="hidden" name={field} {value} />
	{/each}
	<p class="text-sm">
		{#if kind === 'hide'}
			Hide this comment? It leaves the public list, and replies stay under a placeholder. The author
			sees it as hidden.
		{:else if kind === 'reject'}
			Reject this comment? It leaves the public list, and the author sees it as rejected with the
			reason.
		{:else if kind === 'mute'}
			Mute {name}? Until the mute ends, the account cannot write, edit, delete, vote on or report
			comments, and its community reports leave the counts.
		{:else if kind === 'ban'}
			Ban {name}? Its sessions end, it cannot sign in again, its community reports leave the counts,
			and this page has no way to undo a ban.
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
	{#if kind !== 'rejectAll'}
		<label class="field">
			<span class="label">
				{shownToAuthor
					? 'Reason, shown to the author (optional)'
					: 'Reason, kept in the log (optional)'}
			</span>
			<input class="input" name="reason" maxlength={MODERATION_REASON_MAX} autocomplete="off" />
		</label>
	{/if}
	<div class="actions">
		<button
			class="btn btn--ink"
			aria-busy={busy === kind}
			disabled={busy !== null && busy !== kind}
		>
			{BUTTONS[kind]}
		</button>
		<button class="btn btn--ghost" type="button" onclick={oncancel}>Cancel</button>
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

	.actions {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}
</style>
