import { tick } from 'svelte';
import { authClient } from '#lib/auth-client.ts';
import {
	methodErrorMessage,
	passkeyErrorMessage,
	providerErrorMessage,
	type AuthClientError
} from '#lib/auth-errors.ts';
import { providerLabel, type Provider } from '#lib/media/utils/auth-providers.ts';
import { currentDeviceName, DEFAULT_PASSKEY_NAME } from '#lib/media/utils/deviceName.ts';

export interface LinkedAccount {
	id: string;
	providerId: string;
	createdAt: Date | string;
}

export interface PasskeyRow {
	id: string;
	name?: string | null;
	createdAt?: Date | string | null;
}

/** A result shown beside the action it reports on: a row (`account:<id>`, `passkey:<id>`) or the add buttons. */
export interface Result {
	at: string;
	tone: 'error' | 'success';
	text: string;
}

interface Change {
	/** Where a failure shows: the open plate of the row. */
	at: string;
	run: () => Promise<{ error: AuthClientError | null }>;
	success: string;
	/** Where the success shows: the row, or the add buttons when the row is gone. */
	successAt: string;
	fallback: string;
	reload: () => Promise<void>;
	/** What takes focus afterwards: the trigger, or the heading when it is gone. */
	focusId: string;
}

export const HEADING_ID = 'methods-heading';

export const passkeyName = (p: PasskeyRow) => p.name || DEFAULT_PASSKEY_NAME;

/** Moves focus to an element by id, or to the list heading when that element is gone. */
async function focusOn(id: string) {
	await tick();
	(document.getElementById(id) ?? document.getElementById(HEADING_ID))?.focus();
}

/**
 * State and actions of `/user/security`: the linked accounts and passkeys, the one open
 * confirm or rename plate, and the result shown beside the last action. Each list has its own
 * load, so a change refetches only what it touched: every call counts against the auth rate
 * limit.
 */
export class SignInMethods {
	accounts = $state<LinkedAccount[]>([]);
	passkeys = $state<PasskeyRow[]>([]);
	loading = $state(true);
	loadFailed = $state(false);
	busy = $state(false);
	notice = $state<Result | null>(null);
	/** The row with its inline confirm open (`account:<id>` or `passkey:<id>`). */
	confirming = $state<string | null>(null);
	renaming = $state<string | null>(null);
	nameDraft = $state('');

	readonly onlyMethod = $derived(this.accounts.length + this.passkeys.length <= 1);
	/** Passkey names used more than once: those rows show the time as well as the date. */
	readonly duplicateNames = $derived(
		this.passkeys.map(passkeyName).filter((name, i, names) => names.indexOf(name) !== i)
	);

	#say(at: string, tone: Result['tone'], text: string) {
		this.notice = { at, tone, text };
	}

	async #loadAccounts() {
		const { data: rows, error } = await authClient.listAccounts();
		if (error) this.loadFailed = true;
		else this.accounts = rows ?? [];
	}

	async #loadPasskeys() {
		const { data: rows, error } = await authClient.passkey.listUserPasskeys();
		if (error) this.loadFailed = true;
		else this.passkeys = rows ?? [];
	}

	/** Loads both lists; `providerError` is the `?error=` code a failed link redirected back with. */
	async load(providerError: string | null) {
		if (providerError) this.#say('add', 'error', providerErrorMessage(providerError));
		await Promise.all([this.#loadAccounts(), this.#loadPasskeys()]);
		this.loading = false;
	}

	/** Closes a confirm or rename plate and hands focus back to the button that opened it. */
	closePlate(triggerId: string) {
		this.confirming = null;
		this.renaming = null;
		this.notice = null;
		void focusOn(triggerId);
	}

	openConfirm(key: string) {
		this.notice = null;
		this.renaming = null;
		this.confirming = key;
		void focusOn(`confirm-${key}`);
	}

	openRename(p: PasskeyRow) {
		this.notice = null;
		this.confirming = null;
		this.renaming = p.id;
		this.nameDraft = passkeyName(p);
		void tick().then(() => {
			const input = document.getElementById(`rename-${p.id}`) as HTMLInputElement | null;
			input?.focus();
			input?.select();
		});
	}

	/** Runs one change, then reloads the list it touched. */
	async #change(c: Change) {
		this.busy = true;
		this.notice = null;
		const { error } = await c.run();
		if (error) {
			this.busy = false;
			this.#say(c.at, 'error', methodErrorMessage(error, c.fallback));
			return;
		}
		this.confirming = null;
		this.renaming = null;
		this.#say(c.successAt, 'success', c.success);
		await c.reload();
		this.busy = false;
		void focusOn(c.focusId);
	}

	unlink(a: LinkedAccount) {
		return this.#change({
			at: `account:${a.id}`,
			run: () => authClient.unlinkAccount({ accountId: a.id }),
			success: `${providerLabel(a.providerId)} removed.`,
			successAt: 'add',
			fallback: 'The account could not be removed. Try again.',
			reload: () => this.#loadAccounts(),
			focusId: HEADING_ID
		});
	}

	removePasskey(p: PasskeyRow) {
		return this.#change({
			at: `passkey:${p.id}`,
			run: () => authClient.passkey.deletePasskey({ id: p.id }),
			success: 'Passkey deleted.',
			successAt: 'add',
			fallback: 'The passkey could not be deleted. Try again.',
			reload: () => this.#loadPasskeys(),
			focusId: HEADING_ID
		});
	}

	renamePasskey(p: PasskeyRow) {
		return this.#change({
			at: `passkey:${p.id}`,
			run: () => authClient.passkey.updatePasskey({ id: p.id, name: this.nameDraft.trim() }),
			success: 'Passkey renamed.',
			successAt: `passkey:${p.id}`,
			fallback: 'The passkey could not be renamed. Try again.',
			reload: () => this.#loadPasskeys(),
			focusId: `rename-passkey-${p.id}`
		});
	}

	async addPasskey() {
		this.busy = true;
		this.notice = null;
		const { error } = await authClient.passkey.addPasskey({ name: currentDeviceName() });
		if (error) {
			this.busy = false;
			this.#say('add', 'error', passkeyErrorMessage(error, 'add-passkey'));
			return;
		}
		this.#say('add', 'success', 'Passkey added.');
		await this.#loadPasskeys();
		this.busy = false;
	}

	async link(provider: Provider) {
		this.notice = null;
		const { error } = await authClient.linkSocial({
			provider: provider.id,
			callbackURL: '/user/security',
			errorCallbackURL: '/user/security'
		});
		if (error) this.#say('add', 'error', providerErrorMessage(error.code ?? ''));
	}
}
