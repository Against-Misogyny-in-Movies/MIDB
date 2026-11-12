import type { ReportCounts, ViewerReport } from '#lib/server/data/reader-reports.ts';

export type { ReportAnswers, ReportCounts, ViewerReport } from '#lib/server/data/reader-reports.ts';

/** `GET …/reports`: the whole counts at or above `READER_REPORT_MIN`, else the total only. */
export type ReaderReportsResponse = { total: number } | ({ total: number } & ReportCounts);

/** `GET …/reports/viewer`: the reader's own report, if any. */
export type ViewerReportResponse = { report: ViewerReport | null; mutedUntil: string | null };
