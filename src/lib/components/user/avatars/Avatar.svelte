<script lang="ts">
	import { AVATARS } from './avatars';

	interface Props {
		avatarKey?: string | null;
		size?: number;
	}

	let { avatarKey = null, size = 40 }: Props = $props();

	const avatar = $derived(avatarKey ? (AVATARS.find((a) => a.key === avatarKey) ?? null) : null);
</script>

{#if avatar}
	<avatar.component {size} />
{:else}
	<svg
		width={size}
		height={size}
		viewBox="0 0 40 40"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<circle
			cx="20"
			cy="20"
			r="20"
			fill="var(--surface-raised)"
			stroke="var(--border)"
			stroke-width="2"
		/>
		<ellipse cx="20" cy="16" rx="5" ry="6" fill="var(--ink-muted)" opacity="0.4" />
		<path d="M10 34c0-5.523 4.477-10 10-10s10 4.477 10 10" fill="var(--ink-muted)" opacity="0.3" />
	</svg>
{/if}
