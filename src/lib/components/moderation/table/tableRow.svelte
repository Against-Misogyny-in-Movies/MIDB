<script lang="ts">
	import TableDetail from '#lib/components/moderation/table/tableDetail.svelte';
	import ProfileLink from '#lib/components/user/profileLink.svelte';
	import CommentLink from '#lib/components/comments/commentLink.svelte';
	import Badge from '#lib/components/ui/badge.svelte';
	import type { ModerationTableRow } from '#lib/media/types/moderation.ts';
	import {
		COMMENT_STATUS_LABELS,
		REPORT_REASON_LABELS,
		categoryLabel
	} from '#lib/media/utils/comments.ts';
	import { canActOn } from '#lib/media/utils/canActOn.ts';
	import { formatDate } from '#lib/media/utils/format.ts';
	import { commentHref, titleHref } from '#lib/media/utils/titleHref.ts';
	import { commentStatusTone, severityTone } from '#lib/media/utils/tones.ts';

	interface Props {
		row: ModerationTableRow;
		me: { id: string; role: string };
		/** The ids of the rows ticked for a bulk action. */
		selected: string[];
		/** Whether the row's detail is open below it. */
		open: boolean;
		ontoggle: () => void;
	}

	let { row, me, selected = $bindable(), open, ontoggle }: Props = $props();

	const id = $derived(row.comment.id);
	const href = $derived(titleHref(row.title.kind, row.title.tmdbId));
	const permalink = $derived(commentHref(row.title.kind, row.title.tmdbId, id));

	const reasons = $derived([
		...new Set(row.reports.map((report) => REPORT_REASON_LABELS[report.reason]))
	]);
</script>

<tr class="row" data-open={open || undefined}>
	<td class="select">
		<label class="pick">
			<input
				type="checkbox"
				value={id}
				bind:group={selected}
				disabled={!canActOn(me, row.author)}
				aria-label="Select the comment by {row.author.displayName} on {row.title.name}"
				aria-describedby={canActOn(me, row.author) ? undefined : 'not-selectable'}
			/>
		</label>
	</td>
	<td class="comment">
		<p class="clamp body">{row.comment.body}</p>
	</td>
	<td class="author">
		<span class="name"
			><ProfileLink username={row.author.username} name={row.author.displayName} /></span
		>
		{#if row.author.role !== 'user'}
			<Badge tone="brand">
				{row.author.role === 'moderator' ? 'Moderator' : 'Administrator'}
			</Badge>
		{/if}
	</td>
	<td class="title">
		<span class="clamp">
			{#if href}<a class="link" {href}>{row.title.name}</a>{:else}{row.title.name}{/if}
		</span>
	</td>
	<td>
		<Badge tone={commentStatusTone(row.comment.status)}>
			{COMMENT_STATUS_LABELS[row.comment.status]}
		</Badge>
	</td>
	<td>
		<div class="stack">
			{#if row.aiFailure}
				<span class="label">Check failed</span>
			{:else if row.severity === null}
				<span class="label">Not checked</span>
			{:else if row.severity === 0 && row.aiCategories.length === 0}
				<span class="label">Nothing found</span>
			{:else}
				{#if row.severity > 0}
					{#if row.severity >= 2}
						<Badge tone={severityTone(row.severity)}>Severity {row.severity}</Badge>
					{:else}
						<span class="label">Severity {row.severity}</span>
					{/if}
				{/if}
				{#each row.aiCategories as category (category)}
					<Badge tone="neutral">{categoryLabel(category)}</Badge>
				{/each}
			{/if}
		</div>
	</td>
	<td>
		{#if row.reports.length > 0}
			<div class="stack">
				<span class="num count">{row.reports.length} open</span>
				<span class="label">{reasons.join(', ')}</span>
			</div>
		{:else}
			<span class="label">None</span>
		{/if}
	</td>
	<td class="scan">
		{#if row.latestLabel}
			<div class="stack">
				<Badge tone={row.latestLabel.matched ? 'mid' : 'neutral'}>
					{row.latestLabel.matched ? 'Matched' : 'No match'}
				</Badge>
				<span class="label clamp">{row.latestLabel.concern}</span>
			</div>
		{:else}
			<span class="label">Not scanned</span>
		{/if}
	</td>
	<td class="posted">
		<time class="num" datetime={row.comment.createdAt}>{formatDate(row.comment.createdAt)}</time>
	</td>
	<td class="actions">
		<div class="row-actions">
			{#if permalink}
				<CommentLink href={permalink} label="View the comment by {row.author.displayName}" />
			{/if}
			<button
				class="chip"
				type="button"
				aria-expanded={open}
				aria-controls={open ? `detail-${id}` : undefined}
				aria-label="{open ? 'Close' : 'Review'} the comment by {row.author.displayName}"
				onclick={ontoggle}
			>
				{open ? 'Close' : 'Review'}
			</button>
		</div>
	</td>
</tr>
{#if open}
	<TableDetail {row} {me} />
{/if}

<style lang="postcss">
	@reference "../../../../app.css";

	.select {
		width: 2.5rem;
		padding: 0;
	}

	/* The label fills the cell, so the whole cell is the target. */
	.pick {
		@apply flex items-center justify-center cursor-pointer;
		min-width: 2.5rem;
		min-height: 2.25rem;
	}

	.pick input {
		@apply cursor-pointer;
		width: 1rem;
		height: 1rem;
		accent-color: var(--brand);
	}

	.comment {
		min-width: 18rem;
		width: 100%;
	}

	.author,
	.title {
		min-width: 7rem;
		max-width: 10rem;
	}

	.scan {
		min-width: 7rem;
		max-width: 10rem;
	}

	.row[data-open] > td {
		background-color: var(--surface-sunken);
	}

	.body {
		overflow-wrap: anywhere;
	}

	.clamp {
		@apply line-clamp-2;
		overflow-wrap: anywhere;
	}

	.name {
		@apply font-semibold;
		overflow-wrap: anywhere;
	}

	.stack {
		@apply flex flex-col items-start;
		gap: var(--spacing-xs);
	}

	.count {
		@apply font-medium text-ink;
	}

	/* Review stays in view at the row's end while the table scrolls sideways. */
	.row-actions {
		@apply flex items-center;
		gap: var(--spacing-xs);
	}

	.actions {
		position: sticky;
		right: 0;
		padding-right: var(--spacing-md);
		background-color: var(--surface-raised);
		box-shadow: inset 1px 0 0 var(--border);
	}

	@media (pointer: coarse) {
		/* The author's profile link is a standalone link: a 44px touch target. */
		.author .name :global(a) {
			display: inline-flex;
			align-items: center;
			min-height: 2.75rem;
		}

		.actions .chip {
			height: 2.75rem;
		}

		.pick {
			min-width: 2.75rem;
			min-height: 2.75rem;
		}

		.pick input {
			width: 1.375rem;
			height: 1.375rem;
		}
	}
</style>
