<script lang="ts">
	import 'remixicon/fonts/remixicon.css';
	import '../app.css';
	import NavBar from '$lib/components/navigation/navBar.svelte';
</script>

<header class="w-full">
	<NavBar />
</header>
<slot />
