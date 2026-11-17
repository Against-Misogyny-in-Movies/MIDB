<script lang="ts">
	import SettingsCard from '#lib/components/user/settingsCard.svelte';
	import { toasts } from '#lib/media/utils/toasts.svelte.js';

	let running = $state(false);

	/** The file name the endpoint chose (`Content-Disposition`), or a plain one. */
	function filenameOf(response: Response): string {
		const match = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '');
		return match?.[1] ?? 'midb-data.json';
	}

	async function download() {
		if (running) return;
		running = true;
		try {
			const response = await fetch('/api/me/export', { cache: 'no-store' });
			if (response.status === 429) {
				toasts.error('Too many downloads. Try again in a minute.');
				return;
			}
			if (!response.ok) {
				toasts.error('The data could not be downloaded. Try again.');
				return;
			}
			const filename = filenameOf(response);
			const url = URL.createObjectURL(await response.blob());
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			link.click();
			URL.revokeObjectURL(url);
			toasts.success(`Downloaded ${filename}.`);
		} catch {
			toasts.error('The data could not be downloaded. Try again.');
		} finally {
			running = false;
		}
	}
</script>

<SettingsCard
	id="account-data"
	headingId="account-data-heading"
	title="Account data"
	busy={running}
>
	<p>
		A JSON file with the account's details and email, sign-in methods, sessions with their IP
		addresses, comments in every status, community reports, votes, and the reports and flags the
		account made.
	</p>
	<p class="label">It holds no sign-in keys or tokens and nothing from other accounts.</p>
	<div>
		<button
			type="button"
			class="btn btn--ink"
			aria-busy={running}
			disabled={running}
			onclick={download}
		>
			Download data
		</button>
	</div>
</SettingsCard>
