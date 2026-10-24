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
	<ellipse cx="20" cy="14" rx="6" ry="7" fill="var(--brand)" />
	<path d="M8 36c0-6.627 5.373-12 12-12s12 5.373 12 12" fill="var(--brand)" opacity="0.7" />
	<path
		d="M20 5l1.5 4h4l-3.5 2.5 1.5 4L20 13l-3.5 2.5 1.5-4L14.5 9h4z"
		fill="var(--surface)"
		opacity="0.9"
	/>
</svg>
