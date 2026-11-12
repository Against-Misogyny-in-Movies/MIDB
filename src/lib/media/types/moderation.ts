/** What the moderation page shows, defined with its queries and re-exported here as types only. */
export type { ModerationItem, RecentAction } from '#lib/server/data/moderation-queries.ts';

/** What the last moderation form action answered: the comment it concerned, and a failure or what was done. */
export type ActionOutcome = { id: string | null; error?: string; done?: string } | null;
