import { focusAfterUpdate } from '#lib/media/utils/focus.ts';

/**
 * The submit handler of a moderation row's form: it marks the action busy, lets the page update,
 * then puts the focus on the row if it is still there, else on its neighbour or the empty-state
 * line.
 */
export function rowSubmit(
	root: () => HTMLElement | undefined,
	setBusy: (name: string | null) => void,
	afterUpdate?: () => void
) {
	return (name: string) => () => {
		setBusy(name);
		const row = root();
		const neighbour = row?.nextElementSibling ?? row?.previousElementSibling;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			setBusy(null);
			afterUpdate?.();
			await focusAfterUpdate(() =>
				row?.isConnected
					? row
					: ((neighbour?.isConnected ? (neighbour as HTMLElement) : null) ??
						document.getElementById('moderation-empty'))
			);
		};
	};
}
