/** The moderation page's tabs, in the order they show. Each one is a value of `?tab=`. */
export const MODERATION_TABS = ['pending', 'reported', 'table', 'reports', 'log'] as const;
export type ModerationTab = (typeof MODERATION_TABS)[number];

/**
 * The tab a URL opens. `?tab=table` wins (its `title` filter is a name, not a title id); otherwise
 * `?title=` opens that title's community reports, then a `tab` this page knows, else Pending.
 */
export function parseModerationTab(tab: string | null, hasTitle: boolean): ModerationTab {
	if (tab === 'table') return 'table';
	if (hasTitle) return 'reports';
	return MODERATION_TABS.find((t) => t === tab) ?? 'pending';
}

/** The address of a tab, with none of the previous tab's query (table filters, a title). */
export const tabHref = (tab: ModerationTab): string => `?tab=${tab}`;
