<script lang="ts">
	import { goto } from '$app/navigation';
	import { focusAfterUpdate } from '#lib/media/utils/focus.ts';
	import {
		LOG_ACTION_GROUPS,
		LOG_ACTION_LABELS,
		LOG_NAME_MAX,
		logChips,
		type LogFilters
	} from '#lib/media/utils/moderationLog.ts';

	interface Props {
		filters: LogFilters;
	}

	let { filters }: Props = $props();

	const chips = $derived(logChips(filters));

	/** Removes one filter and keeps the focus: on the chip that takes its place, else on Apply. A modified click opens the link as a link does. */
	async function remove(event: MouseEvent, href: string, index: number) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		event.preventDefault();
		await goto(href, { reset: false });
		await focusAfterUpdate(
			() =>
				document.querySelectorAll<HTMLElement>('#log-chips a')[index] ??
				document.getElementById('log-apply')
		);
	}
</script>

<section class="card filters" aria-label="Log filters">
	<form method="GET" data-sveltekit-reset="false">
		<input type="hidden" name="tab" value="log" />
		<div class="grid">
			<label class="field">
				<span class="label">Action</span>
				<select class="input" name="action">
					<option value="">Any action</option>
					{#each LOG_ACTION_GROUPS as group (group.id)}
						<optgroup label={group.label}>
							<option value={group.id} selected={filters.action === group.id}>
								All {group.label.toLowerCase()}
							</option>
							{#each group.actions as action (action)}
								<option value={action} selected={filters.action === action}>
									{LOG_ACTION_LABELS[action]}
								</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</label>
			<label class="field">
				<span class="label">Staff member</span>
				<input
					class="input"
					name="actor"
					value={filters.actor ?? ''}
					maxlength={LOG_NAME_MAX}
					autocomplete="off"
				/>
			</label>
			<label class="field">
				<span class="label">Account</span>
				<input
					class="input"
					name="account"
					value={filters.account ?? ''}
					maxlength={LOG_NAME_MAX}
					autocomplete="off"
				/>
			</label>
		</div>
		<div class="action-row">
			<button class="btn btn--ink" id="log-apply" type="submit">Apply filters</button>
			{#if chips.length > 0}
				<a class="btn btn--ghost" href="?tab=log">Clear filters</a>
			{/if}
		</div>
	</form>

	{#if chips.length > 0}
		<ul class="chips" id="log-chips" aria-label="Active filters">
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
	@reference "../../../app.css";

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
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
	}

	.field {
		@apply flex flex-col;
		gap: var(--spacing-xs);
	}

	.chips {
		@apply flex flex-wrap list-none p-0 m-0;
		gap: var(--spacing-sm);
	}
</style>
