<script lang="ts">
	import {
		COMMENT_STATUS_LABELS,
		MODERATION_SOURCE_LABELS,
		VERDICT_CATEGORIES,
		categoryLabel,
		commentStatus,
		moderationSource
	} from '#lib/media/utils/comments.ts';
	import { TABLE_TEXT_MAX, type TableFilters } from '#lib/media/utils/moderationFilters.ts';
	import { SORT_LABELS, filterChips } from '#lib/media/utils/tableChips.ts';

	interface Props {
		filters: TableFilters;
	}

	let { filters }: Props = $props();

	const chips = $derived(filterChips(filters));
	const sorts = Object.entries(SORT_LABELS);
</script>

<section class="card filters" aria-label="Filters">
	<form method="GET" data-sveltekit-reset="false">
		<input type="hidden" name="tab" value="table" />
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
				<span class="label">Held by</span>
				<select class="input" name="source">
					<option value="">Any</option>
					{#each moderationSource as source (source)}
						<option value={source} selected={filters.source === source}>
							{MODERATION_SOURCE_LABELS[source]}
						</option>
					{/each}
				</select>
			</label>
			<label class="field">
				<span class="label">Sort</span>
				<select class="input" name="sort">
					{#each sorts as [value, label] (value)}
						<option {value} selected={filters.sort === value}>{label}</option>
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
			<button class="btn btn--ink" type="submit">Apply filters</button>
			{#if chips.length > 0}
				<a class="btn btn--ghost" href="?tab=table">Clear filters</a>
			{/if}
		</div>
	</form>

	{#if chips.length > 0}
		<ul class="chips" aria-label="Active filters">
			{#each chips as chip (chip.key)}
				<li>
					<a class="chip" href={chip.href} aria-label="Remove filter: {chip.label}">
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

	form {
		@apply flex flex-col;
		gap: var(--spacing-md);
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
