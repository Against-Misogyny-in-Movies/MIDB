import type { syncSource } from '#db/schema/sources.ts';

/** ISO timestamps of each source's last successful sync; a source that never synced is absent. */
export type SourceSyncDates = Partial<Record<(typeof syncSource)[number], string>>;
