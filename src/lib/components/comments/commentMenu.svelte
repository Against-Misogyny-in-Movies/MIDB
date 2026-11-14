<script lang="ts">
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';

	interface Item {
		label: string;
		/** Set on the item whose panel is open under the comment. */
		expanded?: boolean;
		onselect: () => void;
	}

	interface Props {
		/** The menu button's accessible name. */
		label: string;
		items: Item[];
		disabled?: boolean;
	}

	let { label, items, disabled = false }: Props = $props();

	const id = $props.id();
	let open = $state(false);
	let root: HTMLElement | undefined = $state();
	let toggle: HTMLButtonElement | undefined = $state();

	/** Opens the list and puts the focus on its first item. */
	async function show() {
		open = true;
		await focusAfterUpdate(() => root?.querySelector<HTMLButtonElement>('[data-menu-item]'));
	}

	function close(refocus: boolean) {
		open = false;
		if (refocus) void focusAfterUpdate(() => toggle);
	}

	function select(item: Item) {
		open = false;
		item.onselect();
	}

	/** On the button or an item: Escape closes the list and returns to the button; the arrow keys move between items. */
	function onkeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			close(true);
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		const all = [...(root?.querySelectorAll<HTMLButtonElement>('[data-menu-item]') ?? [])];
		const at = all.indexOf(document.activeElement as HTMLButtonElement);
		const next =
			event.key === 'ArrowDown' ? (at + 1) % all.length : (at - 1 + all.length) % all.length;
		event.preventDefault();
		all[next]?.focus();
	}

	/** A click or a focus outside the menu closes it. */
	function onfocusout(event: FocusEvent) {
		if (open && !root?.contains(event.relatedTarget as Node | null)) open = false;
	}
</script>

<svelte:document
	onpointerdown={(event) => {
		if (open && !root?.contains(event.target as Node)) open = false;
	}}
/>

<div class="menu" bind:this={root} {onfocusout}>
	<button
		class="toggle"
		type="button"
		aria-label={label}
		aria-expanded={open}
		aria-controls={open ? `${id}-list` : undefined}
		{disabled}
		bind:this={toggle}
		{onkeydown}
		onclick={() => (open ? close(false) : void show())}
	>
		<i class="ri-more-fill" aria-hidden="true"></i>
	</button>
	{#if open}
		<ul class="list" id="{id}-list">
			{#each items as item (item.label)}
				<li>
					<button
						class="item"
						type="button"
						data-menu-item
						aria-expanded={item.expanded}
						{onkeydown}
						onclick={() => select(item)}
					>
						{item.label}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style lang="postcss">
	@reference "../../../app.css";

	.menu {
		position: relative;
	}

	.toggle {
		@apply inline-flex items-center justify-center text-ink-muted;
		width: 2rem;
		height: 2rem;
		border: 0;
		border-radius: 8px;
		background: none;
		font-size: 1.125rem;
		cursor: pointer;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.toggle:hover:not(:disabled),
	.toggle[aria-expanded='true'] {
		@apply text-ink;
		background-color: var(--surface-sunken);
	}

	.toggle:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.list {
		@apply list-none m-0 flex flex-col;
		position: absolute;
		top: calc(100% + var(--spacing-xs));
		right: 0;
		z-index: 10;
		min-width: 9rem;
		padding: var(--spacing-xs);
		border: 1px solid var(--border);
		border-radius: 12px;
		background-color: var(--surface-raised);
		box-shadow: var(--shadow-md);
	}

	.item {
		@apply w-full text-left text-sm font-medium text-ink;
		min-height: 2rem;
		padding-inline: var(--spacing-sm);
		border: 0;
		border-radius: 8px;
		background: none;
		cursor: pointer;
	}

	.item:hover,
	.item:focus-visible {
		background-color: var(--surface-sunken);
	}

	@media (pointer: coarse) {
		.toggle {
			width: 2.75rem;
			height: 2.75rem;
		}

		.item {
			min-height: 2.75rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.toggle {
			transition: none;
		}
	}
</style>
