import type { OwnComment } from '#lib/media/types/comments.ts';
import { describeFailure, requestJson } from '#lib/media/utils/commentApi.ts';
import { commentResult } from '#lib/media/utils/comments.ts';
import { toasts } from '#lib/media/utils/toasts.svelte.js';

/** What a saved edit changes on a row. */
export type EditedComment = Pick<OwnComment, 'body' | 'status' | 'moderationReason' | 'editedAt'>;

type Handlers = {
	/** The comment's id. */
	id: () => string;
	/** The server saved an edit: apply it to the row. */
	edited: (saved: EditedComment) => void;
	/** The server deleted the comment: mark the row. */
	deleted: () => void;
	/** After a save or a delete: move the focus back onto the row. */
	settled: () => Promise<void>;
};

/**
 * The edit and delete of the reader's own comment on a row of their history or profile: which
 * panel is open, the request it sends (`PATCH` or `DELETE /api/comments/[id]`), and its outcome
 * as a toast, or, for text the server refuses (a 400), as an error under the field. The row
 * keeps its own copy of the comment and applies the result in place.
 */
export class OwnCommentEditing {
	mode = $state<'edit' | 'delete' | null>(null);
	busy = $state(false);
	/** The server refused the edited text (a 400): shown under the field. Other failures are toasts. */
	error = $state<string | undefined>();

	readonly #on: Handlers;

	constructor(handlers: Handlers) {
		this.#on = handlers;
	}

	toggle(next: 'edit' | 'delete'): void {
		this.mode = this.mode === next ? null : next;
		this.error = undefined;
	}

	cancel(): void {
		this.mode = null;
		this.error = undefined;
	}

	async save(body: string): Promise<boolean> {
		this.busy = true;
		this.error = undefined;
		const reply = await requestJson<{ comment: OwnComment }>(
			(input, init) => fetch(input, init),
			'PATCH',
			`/api/comments/${this.#on.id()}`,
			{ body }
		);
		this.busy = false;
		if (!reply.ok) {
			const message = describeFailure('edit', reply.status, reply.message);
			if (reply.status === 400) this.error = message;
			else toasts.error(message);
			return false;
		}
		const saved = reply.data.comment;
		const result = commentResult('edit', saved);
		toasts.show(result.tone, result.text);
		this.#on.edited({
			body: saved.body,
			status: saved.status,
			moderationReason: saved.moderationReason,
			editedAt: saved.editedAt
		});
		this.mode = null;
		await this.#on.settled();
		return true;
	}

	async remove(): Promise<void> {
		this.busy = true;
		const reply = await requestJson<{ ok: true }>(
			(input, init) => fetch(input, init),
			'DELETE',
			`/api/comments/${this.#on.id()}`
		);
		this.busy = false;
		if (!reply.ok) {
			toasts.error(describeFailure('delete', reply.status, reply.message));
			return;
		}
		this.#on.deleted();
		toasts.success('Comment deleted.');
		this.mode = null;
		await this.#on.settled();
	}
}
