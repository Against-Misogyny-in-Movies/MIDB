<script lang="ts">
	import type { Snippet } from 'svelte';
	import { session } from '$lib/media/utils/session.svelte.js';
	import type { LayoutData } from './$types';

	interface Props {
		data: LayoutData;
		children: Snippet;
	}

	let { data, children }: Props = $props();

	// Effects never run during SSR, so the module-level session is only written in the browser.
	// Re-runs when an action invalidates the layout (e.g. a profile edit renames the navbar chip).
	$effect.pre(() => session.set(data.me));
</script>

{@render children()}
