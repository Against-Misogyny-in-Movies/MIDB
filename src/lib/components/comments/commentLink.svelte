<script lang="ts">
	interface Props {
		/** The comment's address on its title page. */
		href: string;
		/** The link's accessible name and tooltip. */
		label?: string;
	}

	let { href, label = 'View comment' }: Props = $props();
</script>

<a class="chip comment-link" {href} aria-label={label} title={label}>
	<i class="ri-link" aria-hidden="true"></i>
</a>

<style>
	/* A round icon chip: as wide as it is tall, at the chip's height on every pointer. */
	.comment-link {
		justify-content: center;
		aspect-ratio: 1;
		padding-inline: 0;
		font-size: 1rem;
	}
</style>
