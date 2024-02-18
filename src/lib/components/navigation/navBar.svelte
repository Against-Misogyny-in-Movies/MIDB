<script lang="ts">
	import { navRoutes } from '../../../routes/utils';
	import ThemeToggle from '../../components/navigation/themeToggle.svelte';
	import { writable } from 'svelte/store';

	const open = writable(false);

	const handleClick = () => {
		open.update(value => !value);
	};
</script>

<nav class="nav-container">
	<div class="nav-logo">
		<button type="button">
			<span class="logo">MI_DB</span>
		</button>
	</div>

	<div class="nav-items">
		{#each navRoutes as item}
			<a href={item.href}>{item.name}</a>
		{/each}
	</div>

	<div class="nav-toggle">
		<button class="nav-toggle-button" on:click={handleClick}>
			<i class:ri-menu-line={!$open} class:ri-close-line={$open}></i>
		</button>
	</div>

	<ThemeToggle />

	<button class="nav-login hidden md:flex w-xl mr-md" type="button">Log in</button>
</nav>

{#if $open}
	<div class="nav-menu">
		{#each navRoutes as item}
			<a class="nav-menu-item hover:cursor-pointer" href={item.href}>{item.name}</a>
		{/each}
	</div>
{/if}

<style lang="postcss">
	.nav-container {
		@apply flex justify-between max-w-7xl;
		@apply mx-auto font-semibold;
	}
	.nav-logo {
		@apply text-xl font-extrabold select-none;
		@apply bg-gradient-to-r bg-clip-text text-transparent cursor-pointer;
	}
	.nav-items {
		@apply hidden px-md ml-sm md:flex gap-x-xl;
	}
	.nav-toggle {
		@apply flex items-center;
	}
	.nav-toggle-button {
		@apply md:hidden;
	}
	.nav-login {
		@apply hidden md:flex w-xl mr-md;
	}
	.nav-menu {
		@apply md:hidden font-semibold gap-y-sm w-screen pb-md  px-md flex flex-col dark:bg-gray bg-white;
	}
	.nav-menu-item {
		@apply hover:cursor-pointer;
	}
</style>