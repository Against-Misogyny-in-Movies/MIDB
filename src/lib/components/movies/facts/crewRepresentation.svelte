<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { CrewDepartment, GenderBreakdown } from '$lib/media/types/media';

	interface Props {
		crewDepartments: CrewDepartment[];
	}

	let { crewDepartments }: Props = $props();

	const openDepts = new SvelteSet<string>();

	function toggle(dept: string) {
		if (openDepts.has(dept)) openDepts.delete(dept);
		else openDepts.add(dept);
	}

	const GENDERS = [
		{ key: 'female', label: 'Women', short: 'W', color: '--seg-female' },
		{ key: 'male', label: 'Men', short: 'M', color: '--seg-male' },
		{ key: 'nonBinary', label: 'Non-binary', short: 'NB', color: '--seg-nonbinary' },
		{ key: 'unknown', label: 'Unknown', short: '?', color: '--seg-unknown' }
	] as const;

	function pct(count: number, total: number): number {
		return total === 0 ? 0 : Math.round((count / total) * 100);
	}
</script>

{#snippet split(name: string, bd: GenderBreakdown)}
	<td class="bar-col">
		<span
			class="bar"
			role="img"
			aria-label="{name}: {pct(bd.female, bd.total)}% women, {pct(bd.male, bd.total)}% men"
		>
			{#each GENDERS as g (g.key)}
				{#if bd[g.key] > 0}
					<span class="seg" style="width: {(bd[g.key] / bd.total) * 100}%; --seg: var({g.color});"
					></span>
				{/if}
			{/each}
		</span>
	</td>
	{#each GENDERS as g (g.key)}
		<td class="count-col tabular-nums">{bd[g.key]}</td>
	{/each}
{/snippet}

{#if crewDepartments.length === 0}
	<p class="empty">No crew data.</p>
{:else}
	<table class="rep-table">
		<thead>
			<tr>
				<th scope="col">Department</th>
				<th scope="col" class="bar-col"><span class="sr-only">Gender split</span></th>
				{#each GENDERS as g (g.key)}
					<th scope="col" class="count-col">
						<span class="swatch" style="--seg: var({g.color});" aria-hidden="true"></span>
						<abbr title={g.label}>{g.short}</abbr>
					</th>
				{/each}
			</tr>
		</thead>
		{#each crewDepartments as dept (dept.department)}
			{@const isOpen = openDepts.has(dept.department)}
			<tbody class:open={isOpen}>
				<tr class="dept-row">
					<th scope="row">
						<button
							class="dept-toggle"
							type="button"
							aria-expanded={isOpen}
							onclick={() => toggle(dept.department)}
						>
							<i class="ri-arrow-right-s-line chevron" aria-hidden="true"></i>
							{dept.department}
						</button>
					</th>
					{@render split(dept.department, dept.breakdown)}
				</tr>
				{#if isOpen}
					{#each dept.jobs as job (job.job)}
						<tr class="job-row">
							<th scope="row">{job.job}</th>
							{@render split(job.job, job.breakdown)}
						</tr>
					{/each}
				{/if}
			</tbody>
		{/each}
	</table>
{/if}

<style lang="postcss">
	@reference "../../../../app.css";

	.empty {
		@apply text-ink-muted;
	}

	.rep-table {
		@apply w-full text-sm border-collapse;
	}

	th,
	td {
		@apply text-left font-normal align-middle;
		padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) 0;
		border-bottom: 1px solid var(--border);
	}

	thead th {
		@apply text-ink-muted whitespace-nowrap;
	}

	.dept-row th {
		@apply font-medium text-ink;
	}

	.dept-toggle {
		@apply inline-flex items-center gap-xs bg-transparent border-0 p-0 cursor-pointer text-left;
		font: inherit;
		color: inherit;
	}

	.dept-toggle:hover {
		color: var(--brand);
	}

	.chevron {
		@apply text-base text-ink-muted shrink-0;
		transition: transform 0.15s ease;
	}

	.open .chevron {
		transform: rotate(90deg);
	}

	.job-row th {
		@apply text-ink-muted;
		padding-left: 1.25rem;
	}

	.job-row th,
	.job-row td {
		background-color: color-mix(in oklab, var(--surface-sunken) 60%, transparent);
	}

	.bar-col {
		width: 100%;
		min-width: 4rem;
	}

	.bar {
		@apply flex overflow-hidden rounded-sm;
		height: 0.625rem;
		gap: 2px;
		background-color: var(--surface-sunken);
	}

	.seg {
		@apply h-full;
		background-color: var(--seg);
	}

	.count-col {
		@apply text-right font-medium text-ink;
		padding-left: var(--spacing-sm);
		padding-right: 0;
		min-width: 2.25rem;
	}

	thead .count-col {
		@apply font-normal text-ink-muted;
	}

	.job-row .count-col {
		@apply font-normal;
	}

	abbr {
		text-decoration: none;
	}

	.swatch {
		@apply inline-block rounded-xs mr-1;
		width: 0.5rem;
		height: 0.5rem;
		background-color: var(--seg);
	}

	@media (prefers-reduced-motion: reduce) {
		.chevron {
			transition: none;
		}
	}
</style>
