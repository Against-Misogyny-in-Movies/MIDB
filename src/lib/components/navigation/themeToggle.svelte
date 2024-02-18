<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';

	const theme = writable('light');

	onMount(() => {
		if (!browser) {
			return;
		}

		if (
			sessionStorage.theme === 'dark' ||
			(!('theme' in sessionStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
		) {
			document.documentElement.classList.add('dark');
			theme.set('dark');
		} else {
			document.documentElement.classList.remove('dark');
			theme.set('light');
		}
	});

	const clickHandle = () => {
		if ($theme === 'light') {
			document.documentElement.classList.add('dark');
			sessionStorage.setItem('theme', 'dark');
			theme.set('dark');
		} else {
			document.documentElement.classList.remove('dark');
			sessionStorage.setItem('theme', 'light');
			theme.set('light');
		}
	};
</script>

<button type="button" class="text-xl lg:px-lg px-sm" on:click={clickHandle}>
	<i class:ri-sun-line={$theme === 'dark'} class:ri-moon-line={$theme === 'light'}></i>
</button>
