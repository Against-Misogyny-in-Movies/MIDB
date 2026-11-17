import { requestJson } from '#lib/media/utils/commentApi.ts';
import { toasts } from '#lib/media/utils/toasts.svelte.js';

type Options<T, Page> = {
	/** The first page, from the cached page load. */
	first: () => { items: T[]; nextCursor: string | null };
	/** The endpoint's address for the page after `cursor`. */
	path: (cursor: string) => string;
	/** The items of a page the endpoint answered, and the cursor after it. */
	read: (page: Page) => { items: T[]; nextCursor: string | null };
	/** A stable key, so a row on two pages shows once. */
	key: (item: T) => string;
	/** The toast for a failed load, from the status and the server's message. */
	failure: (status: number, message: string) => string;
};

/**
 * A profile list that grows in place: the cached first page, then "Show more" pages from a public
 * endpoint. A failed load is a toast and leaves the list and its cursor as they were.
 */
export class ProfilePager<T, Page> {
	readonly #o: Options<T, Page>;

	/** Pages after the first. */
	more = $state<T[]>([]);
	/** The cursor after the last loaded page; undefined until a page has loaded. */
	cursor = $state<string | null | undefined>(undefined);
	busy = $state(false);

	constructor(options: Options<T, Page>) {
		this.#o = options;
	}

	/** The first page and the later ones, with a row that repeats shown once. */
	shown = $derived.by(() => {
		const first = this.#o.first().items;
		const known = first.map(this.#o.key);
		return [...first, ...this.more.filter((item) => !known.includes(this.#o.key(item)))];
	});

	nextCursor = $derived.by(() =>
		this.cursor === undefined ? this.#o.first().nextCursor : this.cursor
	);

	/**
	 * Loads the next page. Resolves to the index in `shown` of the first new row, or null when
	 * nothing was added (the load failed, or the page held only rows already shown).
	 */
	async showMore(): Promise<number | null> {
		const cursor = this.nextCursor;
		if (!cursor || this.busy) return null;
		this.busy = true;
		const reply = await requestJson<Page>(
			(input, init) => fetch(input, init),
			'GET',
			this.#o.path(cursor)
		);
		this.busy = false;
		if (!reply.ok) {
			toasts.error(this.#o.failure(reply.status, reply.message));
			return null;
		}
		const before = this.shown.length;
		const page = this.#o.read(reply.data);
		this.more = [...this.more, ...page.items];
		this.cursor = page.nextCursor;
		return this.shown.length > before ? before : null;
	}
}
