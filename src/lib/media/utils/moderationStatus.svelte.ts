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
 * holds only the label, which a tab change clears.
 */
class ModerationStatus {
	label = $state<string | null>(null);
	/** True from the moment an action is sent until the page has updated, so a removed row eases out (`easeOut`). */
	acting = false;

	/** Records the action that went through; an action the line has no words for leaves it as it was. */
	say(done: unknown) {
		const label = typeof done === 'string' ? STATUS_LABELS[done] : undefined;
		if (label) this.label = label;
	}

	clear() {
		this.label = null;
	}
}

export const moderationStatus = new ModerationStatus();
