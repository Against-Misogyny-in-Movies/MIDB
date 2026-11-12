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
		error?: string;
		/** True when the error is about the text itself (a length limit), which marks the field invalid. */
		invalid?: boolean;
		notice?: string;
		/** `success` for a posted comment; `warn` for one held or rejected. */
		noticeTone?: 'success' | 'warn';
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
		invalid = false,
		notice,
		noticeTone = 'success',
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

	const length = $derived(body.trim().length);
	const empty = $derived(length === 0);
	const unchanged = $derived(body.trim() === initial.trim());
	const full = $derived(body.length >= COMMENT_BODY_MAX);

	onMount(() => {
		if (autofocus) field?.focus();
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (empty || busy) return;
		if (await onsubmit(body.trim())) body = initial;
	}
</script>

<form class="composer" aria-busy={busy} onsubmit={submit}>
	<label class="sr-only" for="{id}-field">{label}</label>
	<textarea
		id="{id}-field"
		class="input field"
		rows="2"
		maxlength={COMMENT_BODY_MAX}
		bind:value={body}
		bind:this={field}
		readonly={busy}
		aria-invalid={invalid && error ? true : undefined}
		aria-describedby={error ? `${id}-error` : undefined}></textarea>
	<div class="row">
		<button
			class="btn {nested ? 'btn--ink' : 'btn--brand'}"
			class:busy
			type="submit"
			disabled={empty || busy || (initial !== '' && unchanged)}
		>
			{busy ? 'Checking…' : submitLabel}
		</button>
		{#if oncancel}
			<button class="btn btn--ghost" type="button" onclick={oncancel}>Cancel</button>
		{/if}
		<span class="label count" class:count--full={full}>
			{body.length.toLocaleString('en-US')} / {COMMENT_BODY_MAX.toLocaleString('en-US')}
		</span>
	</div>
	<div class="status" class:status--held={busy || error || notice} aria-live="polite">
		{#if busy}
			<p class="label">Checking the comment…</p>
		{:else if error}
			<Notice tone="error" id="{id}-error">{error}</Notice>
		{:else if notice}
			<Notice tone={noticeTone}>{notice}</Notice>
		{/if}
	</div>
	{#if hint && !busy && !error && !notice}
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
	 * The live region for the check and its outcome. While a check runs, and while its outcome
	 * shows, it holds a notice's height (one line, three on a phone) so the outcome replaces the line in place and the
	 * list below does not move.
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

	/* A running check keeps its label readable: the disabled look would drop it below 4.5:1. */
	.btn.busy:disabled {
		opacity: 1;
		cursor: progress;
		background-color: var(--surface-sunken);
		border-color: var(--border);
		color: var(--ink-muted);
	}

	.count {
		@apply ml-auto;
		font-variant-numeric: tabular-nums;
	}

	.count--full {
		color: var(--danger);
	}
</style>
