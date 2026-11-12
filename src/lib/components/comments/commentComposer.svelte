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
		notice?: string;
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
		notice,
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

<form class="composer" onsubmit={submit}>
	<label class="sr-only" for="{id}-field">{label}</label>
	<textarea
		id="{id}-field"
		class="input field"
		rows="3"
		maxlength={COMMENT_BODY_MAX}
		bind:value={body}
		bind:this={field}
		aria-invalid={error ? true : undefined}></textarea>
	<div class="row">
		<button
			class="btn btn--brand"
			type="submit"
			disabled={empty || busy || (initial !== '' && unchanged)}
		>
			{busy ? 'Saving…' : submitLabel}
		</button>
		{#if oncancel}
			<button class="btn btn--ghost" type="button" onclick={oncancel}>Cancel</button>
		{/if}
		<span class="label count" class:count--full={full}>
			{body.length.toLocaleString('en-US')} / {COMMENT_BODY_MAX.toLocaleString('en-US')}
		</span>
	</div>
	{#if hint}
		<p class="label">{hint}</p>
	{/if}
	{#if error}
		<Notice tone="error">{error}</Notice>
	{:else if notice}
		<Notice tone="success">{notice}</Notice>
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
		min-height: 5.5rem;
		padding-block: 10px;
		resize: vertical;
		line-height: 1.5;
	}

	.row {
		@apply flex flex-wrap items-center;
		gap: var(--spacing-sm);
	}

	.count {
		@apply ml-auto;
		font-variant-numeric: tabular-nums;
	}

	.count--full {
		color: var(--danger);
	}
</style>
