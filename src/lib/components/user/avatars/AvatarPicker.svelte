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
			hidden
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
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
	}

	.avatar-tile {
		@apply flex flex-col items-center gap-xs;
		@apply border-2 border-border rounded-lg p-sm cursor-pointer text-center;
		transition: border-color 0.1s;
	}

	.avatar-tile:hover {
		@apply border-ink-muted!;
	}

	input:checked + .avatar-tile {
		@apply border-brand;
	}

	.avatar-name {
		@apply text-xs text-ink-muted leading-tight;
	}
</style>
