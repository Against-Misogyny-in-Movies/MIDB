import type {
	ReaderReportsResponse,
	ViewerReportResponse
} from '#lib/media/types/reader-reports.ts';
import { REPORT_NOTE_MAX } from '#lib/media/utils/comments.ts';
import { requestJson, type Fetcher } from '#lib/media/utils/commentApi.ts';
import type { ContentReportStatus } from '#lib/media/utils/readerReports.ts';
import { reportBody, type ReportDraft } from '#lib/media/utils/reportDraft.ts';

type Action = 'load' | 'viewer' | 'save' | 'delete' | 'flag';

const FAILED: Record<Action, string> = {
	load: 'The reader reports could not be loaded',
	viewer: 'This account’s report could not be loaded',
	save: 'The report was not saved',
	delete: 'The report was not deleted',
	flag: 'The flag was not sent'
};

/** One sentence for a failed request: what failed, and why when the status says. */
function describe(action: Action, status: number, message: string): string {
	const failed = FAILED[action];
	if (status === 0) return `${failed}. The server could not be reached.`;
	if (status === 401) return `${failed}. The session has ended: sign in again.`;
	if (status === 403) {
		if (/banned/i.test(message)) return 'This account is banned and cannot add reader reports.';
		if (/muted/i.test(message)) return 'This account is muted and cannot add reader reports.';
	}
	if (status === 429) return `${failed}. Too many requests: wait a moment and try again.`;
	if (status === 400)
		return action === 'flag'
			? `${failed}. A note is at most ${REPORT_NOTE_MAX} characters.`
			: `${failed}. Some answers contradict each other.`;
	return `${failed}. Try again in a moment.`;
}

/**
 * One title's reader reports: the public counts (edge-cached, the same for every reader), the
 * signed-in reader's own report (`private, no-store`) and the writes. Counts are not refetched
 * after a write, because they are edge-cached and a purge lands a moment later. Each failure
 * is stored under the key of its action, so the component shows it beside that control.
 */
export class ReaderReportsState {
	readonly #base: string;
	readonly #fetch: Fetcher;

	counts = $state<ReaderReportsResponse | null>(null);
	phase = $state<'loading' | 'ready' | 'error'>('loading');
	viewer = $state<ViewerReportResponse | null>(null);
	/** `idle` until a signed-in reader's report is requested; `ready` also after a 401. */
	viewerPhase = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	errors = $state<Partial<Record<Action, string>>>({});
	busy = $state<Partial<Record<Action, boolean>>>({});
	/** The status a save answered, shown once beside the reader's report. */
	saved = $state<{ status: ContentReportStatus } | null>(null);
	flagged = $state(false);

	constructor(kind: 'movie' | 'tv', tmdbId: string, fetcher?: Fetcher) {
		this.#base = `/api/titles/${kind}/${tmdbId}/reports`;
		this.#fetch = fetcher ?? ((input, init) => fetch(input, init));
	}

	async load(): Promise<void> {
		this.phase = 'loading';
		delete this.errors.load;
		const reply = await requestJson<ReaderReportsResponse>(this.#fetch, 'GET', this.#base);
		if (!reply.ok) {
			this.errors.load = describe('load', reply.status, reply.message);
			this.phase = 'error';
			return;
		}
		this.counts = reply.data;
		this.phase = 'ready';
	}

	async loadViewer(): Promise<void> {
		if (this.viewerPhase === 'loading') return;
		this.viewerPhase = 'loading';
		delete this.errors.viewer;
		const reply = await requestJson<ViewerReportResponse>(
			this.#fetch,
			'GET',
			`${this.#base}/viewer`
		);
		if (reply.ok) {
			this.viewer = reply.data;
			this.viewerPhase = 'ready';
		} else if (reply.status === 401) {
			this.viewer = null;
			this.viewerPhase = 'ready';
		} else {
			this.errors.viewer = describe('viewer', reply.status, reply.message);
			this.viewerPhase = 'error';
		}
	}

	clearViewer(): void {
		this.viewer = null;
		this.viewerPhase = 'idle';
		this.saved = null;
		delete this.errors.viewer;
	}

	#start(action: Action): void {
		this.busy[action] = true;
		delete this.errors[action];
	}

	/** Stores the reader's report, then reads it back for its status and the date it counts from. True when stored. */
	async save(draft: ReportDraft): Promise<boolean> {
		this.#start('save');
		const reply = await requestJson<{ status: ContentReportStatus }>(
			this.#fetch,
			'PUT',
			this.#base,
			reportBody(draft)
		);
		if (!reply.ok) {
			this.busy.save = false;
			this.errors.save = describe('save', reply.status, reply.message);
			return false;
		}
		this.saved = { status: reply.data.status };
		await this.loadViewer();
		this.busy.save = false;
		return true;
	}

	async remove(): Promise<boolean> {
		this.#start('delete');
		// A 204 has no body, which `requestJson` would fail to parse.
		let status = 0;
		let message = '';
		try {
			const res = await this.#fetch(this.#base, { method: 'DELETE' });
			status = res.status;
			if (!res.ok) {
				const failure = (await res.json().catch(() => null)) as { message?: string } | null;
				message = failure?.message ?? '';
			}
		} catch {
			status = 0;
		}
		this.busy.delete = false;
		if (status < 200 || status >= 300) {
			this.errors.delete = describe('delete', status, message);
			return false;
		}
		this.saved = null;
		if (this.viewer) this.viewer = { ...this.viewer, report: null };
		return true;
	}

	/** "Counts look wrong", with an optional note. True when sent. */
	async flag(note: string): Promise<boolean> {
		this.#start('flag');
		const reply = await requestJson<{ flagged: true }>(this.#fetch, 'POST', `${this.#base}/flag`, {
			note: note.trim() || null
		});
		this.busy.flag = false;
		if (!reply.ok) {
			this.errors.flag = describe('flag', reply.status, reply.message);
			return false;
		}
		this.flagged = true;
		return true;
	}
}
