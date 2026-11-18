<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import ModerationItemRow from '#lib/components/moderation/moderationItem.svelte';
	import QueueRow from '#lib/components/moderation/queue/queueRow.svelte';
	import type { ModerationItem, QueueName, QueuePage } from '#lib/media/types/moderation.ts';
	import { describeStatus } from '#lib/media/utils/commentApi.ts';
	import { easeOut, vanishOut } from '#lib/media/utils/easeOut.ts';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { moderationPrefs } from '#lib/media/utils/moderationPrefs.svelte.js';
	import { ProfilePager } from '#lib/media/utils/profilePager.svelte.js';

	interface Props {
		/** The first page, from the page load. A reload that replaces it drops the later pages. */
		page: QueuePage<ModerationItem>;
		/** The list's name at `/api/moderation/queue`. */
		queue: Extract<QueueName, 'pending' | 'reported'>;
		me: { id: string; role: string };
		/** What the list says when it has no rows; also the element that takes the focus when the last row leaves. */
		empty: string;
	}

	let { page, queue, me, empty }: Props = $props();

	const FAILED = 'More comments could not be loaded';

	const pager = new ProfilePager<ModerationItem, QueuePage<ModerationItem>>({
		first: () => page,
		path: (cursor) => `/api/moderation/queue?queue=${queue}&cursor=${encodeURIComponent(cursor)}`,
		read: (next) => next,
		key: (item) => item.comment.id,
		failure: (status) =>
			describeStatus(FAILED, status, {
				forbidden: `${FAILED}. Moderation is open to moderators and administrators only.`,
				badRequest: `${FAILED}. Reload the page.`
			}),
		resetOnReload: true
	});
	const items = $derived(pager.shown);

	/**
	 * The open item is component state, not part of the URL: choosing a row is not a navigation,
	 * and a reload opens the first item. When an action removes the open item, the item that took
	 * its place in the list opens (`hint` is where it was).
	 */
	let selectedId = $state<string | null>(null);
	let hint = $state(0);
	const index = $derived.by(() => {
		const at = items.findIndex((item) => item.comment.id === selectedId);
		return at >= 0 ? at : Math.min(hint, items.length - 1);
	});
	const current = $derived(items[index] ?? null);

	$effect(() => {
		if (current && current.comment.id !== selectedId) selectedId = current.comment.id;
		hint = Math.max(index, 0);
	});

	/** The severe comments a moderator chose to read, by id, so a row and its panel agree. */
	const revealed = new SvelteSet<string>();
	const collapsedFor = (item: ModerationItem) =>
		item.severe && moderationPrefs.collapseSevere && !revealed.has(item.comment.id);

	/** The rows in order, with the open item's panel right after its row: under it on a phone, beside the list on a wide screen. */
	const entries = $derived(
		items.flatMap((item) => {
			const row = { key: `row:${item.comment.id}`, kind: 'row' as const, item };
			return item === current
				? [row, { key: `panel:${item.comment.id}`, kind: 'panel' as const, item }]
				: [row];
		})
	);

	let moreButton: HTMLButtonElement | undefined = $state();

	/** Moves the focus to the first row the page added, or back to the button when none was. */
	async function showMore() {
		const firstNew = await pager.showMore();
		await focusAfterUpdate(() =>
			firstNew === null ? moreButton : document.getElementById(`row-${items[firstNew]?.comment.id}`)
		);
	}
</script>

{#if items.length === 0}
	<p class="empty" id="moderation-empty" tabindex="-1">{empty}</p>
{:else}
	<ul class="card row-list list" style:--rows={items.length}>
		{#each entries as entry (entry.key)}
			{#if entry.kind === 'row'}
				<li class="row" out:easeOut|global>
					<QueueRow
						item={entry.item}
						selected={entry.item === current}
						collapsed={collapsedFor(entry.item)}
						onselect={() => (selectedId = entry.item.comment.id)}
					/>
				</li>
			{:else}
				<li class="panel" out:vanishOut|global>
					<ModerationItemRow
						as="div"
						item={entry.item}
						{me}
						fallbackId={() => (current ? `row-${current.comment.id}` : 'moderation-empty')}
						revealed={revealed.has(entry.item.comment.id)}
						onreveal={(show) =>
							show ? revealed.add(entry.item.comment.id) : revealed.delete(entry.item.comment.id)}
					/>
				</li>
			{/if}
		{/each}
	</ul>
	{#if pager.nextCursor}
		<div class="more">
			<button
				class="btn btn--ink"
				type="button"
				aria-busy={pager.busy}
				bind:this={moreButton}
				onclick={showMore}
			>
				Show more
			</button>
		</div>
	{/if}
{/if}

<style lang="postcss">
	@reference "../../../../app.css";

	.empty {
		@apply text-ink-muted;
	}

	/* Rows are plain list items; the open item's panel follows its row. */
	.list {
		overflow: clip;
	}

	/* From a wide screen the list and the panel sit side by side in one card, the column reserved. */
	@media (min-width: 64rem) {
		.list {
			@apply grid;
			grid-template-columns: minmax(0, 22rem) minmax(0, 1fr);
			/* One auto row per item, then a flexible one that takes whatever height the panel needs. */
			grid-template-rows: repeat(var(--rows), auto) 1fr;
			min-height: 30rem;
		}

		/* The hairline between the columns runs the card's full height. */
		.list::before {
			content: '';
			grid-column: 2;
			grid-row: 1 / -1;
			border-left: 1px solid var(--border);
		}

		.list > .row {
			grid-column: 1;
		}

		.list > .panel {
			grid-column: 2;
			grid-row: 1 / -1;
			align-self: start;
			position: sticky;
			top: 5rem;
			max-height: calc(100dvh - 6rem);
			overflow-y: auto;
			border-top: 0;
		}
	}

	.more {
		padding-top: var(--spacing-md);
	}
</style>
