<script lang="ts">
	interface Props {
		size?: number;
	}
	let { size = 40 }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 40 40"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
>
	<circle cx="20" cy="20" r="20" fill="var(--accent)" opacity="0.12" />
	<ellipse cx="20" cy="14" rx="6" ry="7" fill="var(--accent)" />
	<path d="M8 36c0-6.627 5.373-12 12-12s12 5.373 12 12" fill="var(--accent)" opacity="0.7" />
	<circle cx="20" cy="8" r="3" fill="none" stroke="var(--surface)" stroke-width="1.5" />
	<path d="M17 11l3 2 3-2" stroke="var(--surface)" stroke-width="1.5" stroke-linecap="round" />
</svg>
