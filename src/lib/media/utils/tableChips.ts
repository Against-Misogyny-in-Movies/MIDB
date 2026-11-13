import {
	COMMENT_STATUS_LABELS,
	MODERATION_SOURCE_LABELS,
	categoryLabel
} from '#lib/media/utils/comments.ts';
import { filtersToParams, type TableFilters } from '#lib/media/utils/moderationFilters.ts';

/** How each sort reads in a chip. */
export const SORT_LABELS: Record<TableFilters['sort'], string> = {
	newest: 'Newest first',
	oldest: 'Oldest first',
	reports: 'Most reports',
	severity: 'Highest severity'
};

/** The moderation table's URL for a filter set: `?tab=table` and the filters, defaults left out. */
export function tableHref(filters: TableFilters): string {
	const params = new URLSearchParams({ tab: 'table' });
	for (const [key, value] of filtersToParams(filters)) params.append(key, value);
	return `?${params}`;
}

/** An active filter, and the table's URL with just that filter taken off (back to page 1). */
export type FilterChip = { key: string; label: string; href: string };

/** One chip for each active filter value, in the order the form lists them. */
export function filterChips(filters: TableFilters): FilterChip[] {
	const without = (change: Partial<TableFilters>) => tableHref({ ...filters, ...change, page: 1 });
	const chips: FilterChip[] = [];
	const add = (key: string, label: string, change: Partial<TableFilters>) =>
		chips.push({ key, label, href: without(change) });

	if (filters.q) add('q', `Text: ${filters.q}`, { q: undefined });
	for (const status of filters.status ?? []) {
		const rest = filters.status?.filter((s) => s !== status);
		add(`status-${status}`, `Status: ${COMMENT_STATUS_LABELS[status]}`, {
			status: rest?.length ? rest : undefined
		});
	}
	for (const category of filters.categories ?? []) {
		const rest = filters.categories?.filter((c) => c !== category);
		add(`category-${category}`, `Category: ${categoryLabel(category)}`, {
			categories: rest?.length ? rest : undefined
		});
	}
	if (filters.minSeverity) {
		add('severity', `Severity ${filters.minSeverity} or higher`, { minSeverity: undefined });
	}
	if (filters.source) {
		add('source', `Held by: ${MODERATION_SOURCE_LABELS[filters.source]}`, { source: undefined });
	}
	if (filters.reported) add('reported', 'Has open reports', { reported: undefined });
	if (filters.title) add('title', `Title: ${filters.title}`, { title: undefined });
	if (filters.author) add('author', `Author: ${filters.author}`, { author: undefined });
	if (filters.from) add('from', `From ${filters.from}`, { from: undefined });
	if (filters.to) add('to', `Until ${filters.to}`, { to: undefined });
	if (filters.sort !== 'newest') add('sort', SORT_LABELS[filters.sort], { sort: 'newest' });
	return chips;
}
