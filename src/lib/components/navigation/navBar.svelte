<script lang="ts">
	import ThemeToggle from '$lib/components/navigation/themeToggle.svelte';
	import { navRoutes } from '../../../routes/utils';

	let open = true;

	const handleClick = () => {
		open = !open;
	};
</script>

<nav class="px-2 sm:px-6 lg:px-8 text-md">
	<div class="container">
		<div>
			<a href="#">
				<span class="logo dark:from-gradient3 dark:to-gradient1 from-gradient1 to-gradient2"
					>MI_DB</span
				>
			</a>
		</div>

		<div class="items">
			{#each navRoutes as item}
				<a href={item.href}>{item.name}</a>
			{/each}
		</div>
	</div>
	<div class="flex items-center">
		<button class="md:hidden" on:click={handleClick}>
			<i class:ri-menu-line={!open} class:ri-close-line={open}></i>
		</button>

		<ThemeToggle />
		<a class="hidden md:flex w-xl mr-md" href="#">Log in</a>
	</div>
</nav>

{#if open}
	<div class="menu text-md absolute z-50">
		{#each navRoutes as item}
			<a class="hover:cursor-pointer" href={item.href}>{item.name}</a>
		{/each}
	</div>
{/if}

<style lang="postcss">
	nav {
		@apply flex justify-between max-w-7xl;
		@apply mx-auto font-semibold;
	}
	.container {
		@apply flex items-center justify-start py-lg h-xl p-md lg:px-xl;
	}
	.logo {
		@apply text-xl font-extrabold select-none;
		@apply bg-gradient-to-r bg-clip-text text-transparent cursor-pointer;
	}
	.items {
		@apply hidden px-md ml-sm md:flex gap-x-xl;
	}
	.menu {
		@apply md:hidden font-semibold gap-y-sm w-screen pb-md  px-md flex flex-col dark:bg-gray bg-white;
	}
</style>
