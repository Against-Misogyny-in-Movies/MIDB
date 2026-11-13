/**
 * The toasts: the outcome of an action the reader took (a comment posted, a report saved, a
 * moderator's action), shown by `layout/toaster.svelte` at the foot of the viewport. A message
 * about a field, a section that failed to load or a standing state stays inline beside what it
 * describes (`DESIGN.md`, Components).
 *
 * Toasts are raised from event handlers in the browser only, never during server rendering, so
 * this one module-level store is never shared between requests.
 */
export type ToastTone = 'success' | 'warn' | 'error';

export interface Toast {
	id: number;
	tone: ToastTone;
	text: string;
}

/** At most this many show at once; the oldest goes first. */
export const TOAST_LIMIT = 3;

/**
 * How long a toast stays, in ms, while the pointer and focus are elsewhere: long enough to read
 * the text at about 15 characters a second. An error stays until the reader closes it.
 */
export function toastDuration(toast: Pick<Toast, 'tone' | 'text'>): number | null {
	if (toast.tone === 'error') return null;
	return Math.max(5000, toast.text.length * 70);
}

class Toasts {
	items = $state<Toast[]>([]);
	#next = 1;
	#timers = new Map<number, ReturnType<typeof setTimeout>>();

	/** Shows a toast and returns its id. The same text already showing is shown again, not stacked. */
	show(tone: ToastTone, text: string): number {
		const same = this.items.find((t) => t.tone === tone && t.text === text);
		if (same) this.dismiss(same.id);
		const toast = { id: this.#next++, tone, text };
		this.items = [...this.items, toast].slice(-TOAST_LIMIT);
		for (const id of this.#timers.keys()) {
			if (!this.items.some((t) => t.id === id)) this.#clearTimer(id);
		}
		this.resume(toast.id);
		return toast.id;
	}

	success(text: string): number {
		return this.show('success', text);
	}

	warn(text: string): number {
		return this.show('warn', text);
	}

	error(text: string): number {
		return this.show('error', text);
	}

	dismiss(id: number): void {
		this.#clearTimer(id);
		this.items = this.items.filter((t) => t.id !== id);
	}

	/** Stops the timer while the reader points at or focuses the toast. */
	pause(id: number): void {
		this.#clearTimer(id);
	}

	/** Starts the toast's timer again from its full length. */
	resume(id: number): void {
		const toast = this.items.find((t) => t.id === id);
		const ms = toast ? toastDuration(toast) : null;
		if (ms === null) return;
		this.#clearTimer(id);
		this.#timers.set(
			id,
			setTimeout(() => this.dismiss(id), ms)
		);
	}

	/** Removes every toast. For tests. */
	clear(): void {
		for (const id of this.#timers.keys()) this.#clearTimer(id);
		this.items = [];
	}

	#clearTimer(id: number): void {
		const timer = this.#timers.get(id);
		if (timer !== undefined) clearTimeout(timer);
		this.#timers.delete(id);
	}
}

export const toasts = new Toasts();
