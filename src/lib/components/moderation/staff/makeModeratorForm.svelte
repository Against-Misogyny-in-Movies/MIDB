<script lang="ts">
	import { enhance } from '$app/forms';
	import { rowSubmit } from '#lib/media/utils/rowSubmit.ts';

	let busy = $state<string | null>(null);
	let root: HTMLElement | undefined = $state();
	let username = $state('');
	const submit = rowSubmit(
		() => root,
		(name) => (busy = name)
	);

	/** The name stays in the field when the server refuses it, and clears once the role is given. */
	const give = () => {
		const run = submit('makeModerator')();
		return async (event: Parameters<typeof run>[0]) => {
			await run(event);
			if (event.result.type === 'success') username = '';
		};
	};
</script>

<form class="plate" method="POST" action="?/makeModerator" use:enhance={give} bind:this={root}>
	<label class="field">
		<span class="label">Make an account a moderator</span>
		<span class="line">
			<input
				class="input"
				id="make-moderator-field"
				name="username"
				placeholder="Username"
				maxlength="32"
				autocomplete="off"
				required
				bind:value={username}
			/>
			<button
				class="btn btn--ink"
				aria-busy={busy === 'makeModerator'}
				disabled={username.trim() === '' || (busy !== null && busy !== 'makeModerator')}
			>
				Make moderator
			</button>
		</span>
	</label>
	<p class="label">
		A moderator reviews comments and community reports, and mutes or bans ordinary accounts. The
		change is written to the log. The administrator role is given only by the seed script (<code
			>pnpm db:seed:admin</code
		>).
	</p>
</form>

<style lang="postcss">
	@reference "../../../../app.css";

	.plate {
		@apply flex flex-col;
		gap: var(--spacing-sm);
	}

	.field {
		@apply flex flex-col;
		gap: var(--spacing-xs);
	}

	.line {
		@apply flex flex-wrap;
		gap: var(--spacing-sm);
	}

	.input {
		@apply flex-1;
		min-width: 12rem;
		max-width: 20rem;
	}
</style>
