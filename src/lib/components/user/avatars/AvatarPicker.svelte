<script lang="ts">
	import { AVATAR_DEFS } from '$lib/media/utils/avatars';
	import { AVATAR_COMPONENTS } from './avatars';

	interface Props {
		value?: string | null;
		onselect?: (key: string) => void;
	}

	let { value = null, onselect }: Props = $props();

	const groupName = $props.id();
</script>

<div class="picker" role="radiogroup" aria-label="Choose avatar">
	{#each AVATAR_DEFS as avatar (avatar.key)}
		{@const AvatarIcon = AVATAR_COMPONENTS[avatar.key]}
		<input
			type="radio"
			id="{groupName}-{avatar.key}"
			name={groupName}
			value={avatar.key}
			checked={value === avatar.key}
			onchange={() => onselect?.(avatar.key)}
			class="sr-only"
		/>
		<label for="{groupName}-{avatar.key}" class="avatar-tile">
			<AvatarIcon size={48} />
			<span class="avatar-name">{avatar.name}</span>
		</label>
	{/each}
</div>

<style lang="postcss">
	@reference "../../../../app.css";

	.picker {
		@apply grid gap-sm;
		grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
	}

	.avatar-tile {
		@apply flex flex-col items-center gap-xs rounded-md p-sm cursor-pointer text-center;
		border: 1px solid var(--border);
		transition:
			border-color 0.15s ease,
			background-color 0.15s ease;
	}

	.avatar-tile:hover {
		border-color: var(--ink-muted);
	}

	input:checked + .avatar-tile {
		border-color: var(--brand);
		background-color: color-mix(in oklab, var(--brand) 8%, transparent);
		box-shadow: inset 0 0 0 1px var(--brand);
	}

	input:focus-visible + .avatar-tile {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}

	.avatar-name {
		@apply text-xs text-ink-muted leading-tight;
	}
</style>
