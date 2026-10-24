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
	<circle cx="20" cy="20" r="20" fill="var(--brand)" opacity="0.12" />
	<ellipse cx="20" cy="15" rx="7" ry="8" fill="var(--brand)" />
	<path d="M8 36c0-6.627 5.373-12 12-12s12 5.373 12 12" fill="var(--brand)" opacity="0.7" />
	<!-- afro silhouette hint -->
	<path
		d="M13 14c0-3.866 3.134-7 7-7s7 3.134 7 7"
		stroke="var(--surface)"
		stroke-width="2"
		fill="none"
		stroke-linecap="round"
	/>
</svg>
