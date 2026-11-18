/** What a moderation action that went through says on the status line, by the action's name. */
const STATUS_LABELS: Record<string, string> = {
	approve: 'Approved',
	hide: 'Hidden',
	reject: 'Rejected',
	restore: 'Restored',
	dismiss: 'Reports dismissed',
	mute: 'Account muted',
	ban: 'Account banned',
	unmute: 'Mute ended',
	unban: 'Ban lifted'
};

/**
 * The result of the last action on a queue, which the page turns into the status line under the
 * tabs ("Hidden. 41 left in Pending."). The count comes from the load, so the page owns it; this
 * holds the label, which a tab change clears, and the reader of the count (`left`).
 */
class ModerationStatus {
	label = $state<string | null>(null);
	/** True from the moment an action is sent until the page has updated, so a removed row eases out (`easeOut`). */
	acting = false;

	/**
	 * What remains in the open queue ("41 left in Pending."), read from the page's data when an
	 * action's toast is made, since the toast is the one announcement of the result. The queue page
	 * sets it; it is null elsewhere.
	 */
	left: (() => string) | null = null;

	/**
	 * Records the action that went through and says whether the status line has words for it; an
	 * action it has none for leaves the label as it was.
	 */
	say(done: unknown): boolean {
		const label = typeof done === 'string' ? STATUS_LABELS[done] : undefined;
		if (label) this.label = label;
		return label !== undefined;
	}

	clear() {
		this.label = null;
	}
}

export const moderationStatus = new ModerationStatus();
