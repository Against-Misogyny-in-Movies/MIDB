import type {
	CommunityReportsResponse,
	ViewerReportResponse
} from '#lib/media/types/community-reports.ts';
import { REPORT_NOTE_MAX } from '#lib/media/utils/comments.ts';
import { describeStatus, requestJson, type Fetcher } from '#lib/media/utils/commentApi.ts';
import type { ContentReportStatus } from '#lib/media/utils/communityReports.ts';
import { reportBody, type ReportDraft } from '#lib/media/utils/reportDraft.ts';
import { toasts } from '#lib/media/utils/toasts.svelte.js';

type Action = 'load' | 'viewer' | 'save' | 'delete' | 'flag';

const FAILED: Record<Action, string> = {
	load: 'The community reports could not be loaded',
	viewer: 'This account’s report could not be loaded',
	save: 'The report was not saved',
	delete: 'The report was not deleted',
	flag: 'The flag was not sent'
};

/** One sentence for a failed request: what failed, and why when the status says. */
function describe(action: Action, status: number): string {
	const failed = FAILED[action];
	return describeStatus(failed, status, {
		forbidden: `${failed}. This account is muted.`,
		badRequest:
			action === 'flag'
				? `${failed}. A note is at most ${REPORT_NOTE_MAX} characters.`
				: `${failed}. The server refused the answers.`
	});
}

/**
 * One title's community reports: the public counts (edge-cached, the same for every reader), the
 * signed-in reader's own report (`private, no-store`) and the writes. Counts are not refetched
 * after a write, because they are edge-cached and a purge lands a moment later. A failed load
 * is stored under its key (`load`, `viewer`), so the section shows it in place; a failed write
 * is a toast (`toasts.svelte.ts`), and so is the result of a delete or a flag, worded here. A
 * save's result depends on the standing read back after it, so `communityReportOwn` words it.
 */
export class CommunityReportsState {
	readonly #base: string;
	readonly #fetch: Fetcher;

	counts = $state<CommunityReportsResponse | null>(null);
	phase = $state<'loading' | 'ready' | 'error'>('loading');
	viewer = $state<ViewerReportResponse | null>(null);
	/** `idle` until a signed-in reader's report is requested; `ready` also after a 401. */
	viewerPhase = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	errors = $state<Partial<Record<'load' | 'viewer', string>>>({});
	busy = $state<Partial<Record<Action, boolean>>>({});

	constructor(kind: 'movie' | 'tv', tmdbId: string, fetcher?: Fetcher) {
		this.#base = `/api/titles/${kind}/${tmdbId}/reports`;
		this.#fetch = fetcher ?? ((input, init) => fetch(input, init));
	}

	async load(): Promise<void> {
		this.phase = 'loading';
		delete this.errors.load;
		const reply = await requestJson<CommunityReportsResponse>(this.#fetch, 'GET', this.#base);
		if (!reply.ok) {
			this.errors.load = describe('load', reply.status);
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
			this.errors.viewer = describe('viewer', reply.status);
			this.viewerPhase = 'error';
		}
	}

	clearViewer(): void {
		this.viewer = null;
		this.viewerPhase = 'idle';
		delete this.errors.viewer;
	}

	/**
	 * Stores the reader's report, then reads it back for its status and the date it counts from.
	 * Returns the status the save answered, or null when it failed.
	 */
	async save(draft: ReportDraft): Promise<ContentReportStatus | null> {
		this.busy.save = true;
		const reply = await requestJson<{ status: ContentReportStatus }>(
			this.#fetch,
			'PUT',
			this.#base,
			reportBody(draft)
		);
		if (!reply.ok) {
			this.busy.save = false;
			toasts.error(describe('save', reply.status));
			return null;
		}
		await this.loadViewer();
		this.busy.save = false;
		return reply.data.status;
	}

	async remove(): Promise<boolean> {
		this.busy.delete = true;
		const reply = await requestJson<undefined>(this.#fetch, 'DELETE', this.#base);
		this.busy.delete = false;
		if (!reply.ok) {
			toasts.error(describe('delete', reply.status));
			return false;
		}
		if (this.viewer) this.viewer = { ...this.viewer, report: null };
		toasts.success('Report deleted. A reload shows the counts without it.');
		return true;
	}

	/** "Counts look wrong", with an optional note. True when sent; a second flag replaces the note. */
	async flag(note: string): Promise<boolean> {
		this.busy.flag = true;
		const reply = await requestJson<{ flagged: true }>(this.#fetch, 'POST', `${this.#base}/flag`, {
			note: note.trim() || null
		});
		this.busy.flag = false;
		if (!reply.ok) {
			toasts.error(describe('flag', reply.status));
			return false;
		}
		toasts.success('Sent to the moderators.');
		return true;
	}
}
