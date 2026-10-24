<script lang="ts">
	interface Props { size?: number; }
	let { size = 40 }: Props = $props();
</script>

<svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
	<circle cx="20" cy="20" r="20" fill="var(--accent)" opacity="0.12"/>
	<ellipse cx="20" cy="14" rx="6" ry="7" fill="var(--accent)"/>
	<path d="M8 36c0-6.627 5.373-12 12-12s12 5.373 12 12" fill="var(--accent)" opacity="0.7"/>
	<!-- unibrow hint -->
	<path d="M14 10c2-1.5 4-1.5 6 0" stroke="var(--surface)" stroke-width="1.5" stroke-linecap="round"/>
	<!-- flower -->
	<circle cx="27" cy="8" r="2" fill="var(--surface)" opacity="0.8"/>
	<path d="M25 6l2-2M29 6l-2-2M27 10v-2" stroke="var(--surface)" stroke-width="1" stroke-linecap="round"/>
</svg>
