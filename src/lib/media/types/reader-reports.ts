import type { ReportCounts, ViewerReport } from '#lib/server/data/reader-reports.ts';

export type { ReportAnswers, ReportCounts, ViewerReport } from '#lib/server/data/reader-reports.ts';

/** `GET …/reports`: the whole counts at or above `READER_REPORT_MIN`, else the total only. */
export type ReaderReportsResponse = { total: number } | ({ total: number } & ReportCounts);

/** The reader's own report as the viewer endpoint sends it: its dates are ISO strings in the JSON. */
export type ViewerReportView = Omit<ViewerReport, 'createdAt' | 'updatedAt' | 'countsFrom'> & {
	createdAt: string;
	updatedAt: string;
	/** When the report starts counting: the account's age reaches the minimum. */
	countsFrom: string;
};

/** `GET …/reports/viewer`: the reader's own report, if any. */
export type ViewerReportResponse = { report: ViewerReportView | null; mutedUntil: string | null };
