<script lang="ts">
	import { onMount } from 'svelte';
	import Notice from '#lib/components/ui/notice.svelte';
	import { COMMENT_BODY_MAX } from '#lib/media/utils/comments.ts';

	interface Props {
		/** The field's accessible name; the field has no visible label. */
		label: string;
		submitLabel: string;
		initial?: string;
		busy?: boolean;
		/** The server refused the text itself (a length limit): shown under the field, which it marks invalid. */
		error?: string;
		/** A reply or an edit: its button is secondary, because the section's own composer is the main action. */
		nested?: boolean;
		/** Sets the keyboard focus on the field when it mounts (a reply or an edit just opened). */
		autofocus?: boolean;
		/** A line under the field that says what saving does. */
		hint?: string;
		/** Resolves true when the text was stored, which clears the field. */
		onsubmit: (body: string) => Promise<boolean>;
		oncancel?: () => void;
	}

	let {
		label,
		submitLabel,
		initial = '',
		busy = false,
		error,
		nested = false,
		autofocus = false,
		hint,
		onsubmit,
		oncancel
	}: Props = $props();

	const id = $props.id();
	// The field starts from `initial` once; a new edit mounts a new composer.
	// svelte-ignore state_referenced_locally
	let body = $state(initial);
	let field: HTMLTextAreaElement | undefined = $state();
	/** Set when a check ends; the slot keeps its height until the next keystroke, so the list below does not move up. */
	let settled = $state(false);

	const length = $derived(body.trim().length);
	const empty = $derived(length === 0);
	const unchanged = $derived(body.trim() === initial.trim());
	const full = $derived(body.length >= COMMENT_BODY_MAX);
	/** The count shows once the text nears the limit; a short comment needs no counter. */
	const nearLimit = $derived(body.length >= COMMENT_BODY_MAX * 0.8);

	onMount(() => {
		if (autofocus) field?.focus();
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (empty || busy) return;
		const stored = await onsubmit(body.trim());
		settled = true;
		if (stored) body = initial;
	}
</script>

<form class="composer" aria-busy={busy} onsubmit={submit}>
	<label class="sr-only" for="{id}-field">{label}</label>
	<textarea
		id="{id}-field"
		class="input field"
		rows="2"
		placeholder={label}
		maxlength={COMMENT_BODY_MAX}
		bind:value={body}
		bind:this={field}
		oninput={() => (settled = false)}
		readonly={busy}
		aria-invalid={error ? true : undefined}
		aria-describedby={error ? `${id}-error` : undefined}></textarea>
	<div class="row">
		<button
			class="btn {nested ? 'btn--ink' : 'btn--brand'}"
			type="submit"
			aria-busy={busy}
			disabled={!busy && (empty || (initial !== '' && unchanged))}
		>
			{submitLabel}
		</button>
		{#if oncancel}
			<button class="btn btn--ghost" type="button" onclick={oncancel}>Cancel</button>
		{/if}
		{#if nearLimit}
			<span class="label count" class:count--full={full}>
				{body.length.toLocaleString('en-US')} / {COMMENT_BODY_MAX.toLocaleString('en-US')}
			</span>
		{/if}
	</div>
	<div class="status" class:status--held={busy || error || settled} aria-live="polite">
		{#if busy}
			<p class="label">Checking the comment…</p>
		{:else if error}
			<Notice tone="error" id="{id}-error">{error}</Notice>
		{/if}
	</div>
	{#if hint && !busy && !error && !settled}
		<p class="label">{hint}</p>
	{/if}
</form>

<style lang="postcss">
	@reference "../../../app.css";

	.composer {
		@apply flex flex-col;
		gap: var(--spacing-sm);
	}

	/* The shared text field, grown to hold a paragraph. */
	.field {
		height: auto;
		min-height: var(--comment-field-height);
		padding-block: 10px;
		resize: vertical;
		line-height: 1.5;
	}

	.row {
		@apply flex flex-wrap items-center;
		gap: var(--spacing-sm);
	}

	/*
	 * The live region for the check, and for a refusal of the text. While a check runs, while a
	 * refusal shows and after the check until the next keystroke, it holds a notice's height (one
	 * line, three on a phone), so the list below does not move. Every other outcome is a toast.
	 */
	.status {
		min-height: 0;
	}

	.status--held {
		min-height: 2.75rem;
	}

	@media (max-width: 40rem) {
		.status--held {
			min-height: 5.25rem;
		}
	}

	.count {
		@apply ml-auto;
		font-variant-numeric: tabular-nums;
	}

	.count--full {
		color: var(--danger);
	}
</style>
