<script lang="ts">
	import {
		COMMENT_STATUS_LABELS,
		MODERATION_SOURCE_LABELS,
		VERDICT_CATEGORIES,
		categoryLabel,
		commentStatus,
		moderationSource
	} from '#lib/media/utils/comments.ts';
	import { goto } from '$app/navigation';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import { TABLE_TEXT_MAX, type TableFilters } from '#lib/media/utils/moderationFilters.ts';
	import { TABLE_FOCUS, filterChips } from '#lib/media/utils/tableChips.ts';

	interface Props {
		filters: TableFilters;
	}

	let { filters }: Props = $props();

	const chips = $derived(filterChips(filters));
	/** The form's fields hold a filter, so the form opens; a sort alone is set above the table. */
	const fieldsSet = $derived(chips.some((chip) => chip.key !== 'sort'));

	/**
	 * Removes one filter and keeps the focus: it goes to the chip that takes the removed one's
	 * place, else to Apply, else (the form being closed) to its toggle. A modified click or a
	 * middle click opens the link as a link does.
	 */
	async function remove(event: MouseEvent, href: string, index: number) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		event.preventDefault();
		await goto(href, { reset: false });
		await focusAfterUpdate(() => {
			const next = document.querySelectorAll<HTMLElement>(`#${TABLE_FOCUS.chips} a`)[index];
			const apply = document.getElementById(TABLE_FOCUS.apply);
			const toggle = document.getElementById(TABLE_FOCUS.filtersToggle);
			return next ?? (apply?.closest('details')?.open ? apply : toggle);
		});
	}
</script>

<section class="card filters" aria-label="Filters">
	<details class="fields" open={fieldsSet}>
		<summary class="btn btn--ghost" id={TABLE_FOCUS.filtersToggle}>Filters</summary>
		<form method="GET" data-sveltekit-reset="false">
			<input type="hidden" name="tab" value="table" />
			{#if filters.sort !== 'newest'}
				<input type="hidden" name="sort" value={filters.sort} />
			{/if}
			<div class="grid">
				<label class="field">
					<span class="label">Comment text</span>
					<input
						class="input"
						name="q"
						value={filters.q ?? ''}
						maxlength={TABLE_TEXT_MAX}
						autocomplete="off"
					/>
				</label>
				<label class="field">
					<span class="label">Title</span>
					<input
						class="input"
						name="title"
						value={filters.title ?? ''}
						maxlength={TABLE_TEXT_MAX}
						autocomplete="off"
					/>
				</label>
				<label class="field">
					<span class="label">Author</span>
					<input
						class="input"
						name="author"
						value={filters.author ?? ''}
						maxlength={TABLE_TEXT_MAX}
						autocomplete="off"
					/>
				</label>
				<label class="field">
					<span class="label">Posted from</span>
					<input class="input" type="date" name="from" value={filters.from ?? ''} />
				</label>
				<label class="field">
					<span class="label">Posted until</span>
					<input class="input" type="date" name="to" value={filters.to ?? ''} />
				</label>
				<label class="field">
					<span class="label">Lowest severity</span>
					<select class="input" name="severity">
						<option value="">Any</option>
						{#each [1, 2, 3] as level (level)}
							<option value={level} selected={filters.minSeverity === level}>
								{level} or higher
							</option>
						{/each}
					</select>
				</label>
				<label class="field">
					<span class="label">Status set by</span>
					<select class="input" name="source">
						<option value="">Any</option>
						{#each moderationSource as source (source)}
							<option value={source} selected={filters.source === source}>
								{MODERATION_SOURCE_LABELS[source]}
							</option>
						{/each}
					</select>
				</label>
			</div>

			<fieldset class="group">
				<legend class="label">Status</legend>
				{#each commentStatus as status (status)}
					<label class="check">
						<input
							type="checkbox"
							name="status"
							value={status}
							checked={filters.status?.includes(status) ?? false}
						/>
						{COMMENT_STATUS_LABELS[status]}
					</label>
				{/each}
				<label class="check">
					<input type="checkbox" name="reported" value="1" checked={filters.reported ?? false} />
					Has open reports
				</label>
			</fieldset>

			<details class="categories" open={(filters.categories?.length ?? 0) > 0}>
				<summary class="label">Categories</summary>
				<fieldset class="group">
					<legend class="sr-only">Categories</legend>
					{#each VERDICT_CATEGORIES as category (category)}
						<label class="check">
							<input
								type="checkbox"
								name="category"
								value={category}
								checked={filters.categories?.includes(category) ?? false}
							/>
							{categoryLabel(category)}
						</label>
					{/each}
				</fieldset>
			</details>

			<div class="actions">
				<button class="btn btn--ink" id={TABLE_FOCUS.apply} type="submit">Apply filters</button>
				{#if chips.length > 0}
					<a class="btn btn--ghost" href="?tab=table">Clear filters</a>
				{/if}
			</div>
		</form>
	</details>

	{#if chips.length > 0}
		<ul class="chips" id={TABLE_FOCUS.chips} tabindex="-1" aria-label="Active filters">
			{#each chips as chip, index (chip.key)}
				<li>
					<a
						class="chip"
						href={chip.href}
						aria-label="Remove filter: {chip.label}"
						onclick={(event) => remove(event, chip.href, index)}
					>
						{chip.label}<i class="ri-close-line" aria-hidden="true"></i>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style lang="postcss">
	@reference "../../../../app.css";

	.filters {
		@apply flex flex-col;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
	}

	.fields > summary {
		@apply cursor-pointer;
		display: inline-flex;
		list-style: none;
	}

	.fields > summary::-webkit-details-marker {
		display: none;
	}

	form {
		@apply flex flex-col;
		gap: var(--spacing-md);
		margin-top: var(--spacing-md);
	}

	.grid {
		@apply grid;
		gap: var(--spacing-sm) var(--spacing-md);
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
	}

	.field {
		@apply flex flex-col;
		gap: var(--spacing-xs);
	}

	.group {
		@apply flex flex-wrap border-0 p-0 m-0;
		gap: var(--spacing-xs) var(--spacing-md);
	}

	.group legend {
		@apply p-0;
		margin-bottom: var(--spacing-xs);
	}

	.check {
		@apply inline-flex items-center text-sm cursor-pointer;
		gap: var(--spacing-sm);
		min-height: 1.75rem;
	}

	.check input {
		width: 1rem;
		height: 1rem;
		accent-color: var(--brand);
	}

	@media (pointer: coarse) {
		.check {
			min-height: 2.75rem;
		}
	}

	.categories summary {
		@apply cursor-pointer;
		margin-bottom: var(--spacing-sm);
	}

	.actions {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}

	.chips {
		@apply flex flex-wrap list-none p-0 m-0;
		gap: var(--spacing-sm);
	}
</style>
