<script lang="ts">
  import type { Snippet } from 'svelte';
  import 'remixicon/fonts/remixicon.css';
  import '../app.css';
  import Navbar from '$lib/components/layout/navbar.svelte';
  import Footer from '$lib/components/layout/footer.svelte';
  import NavProgress from '$lib/components/layout/navProgress.svelte';

  interface Props {
    children: Snippet;
    data: { user?: import('$lib/server/data/user-queries').UserRow | null };
  }

  let { children, data }: Props = $props();
</script>

<NavProgress />

<div class="shell">
  <header class="header-wrap">
    <Navbar user={data.user ?? null} />
  </header>

  <main>
    {@render children()}
  </main>

  <Footer />
</div>

<style lang="postcss">
  @reference "../app.css";

  .shell {
    @apply flex flex-col min-h-screen;
  }

  .header-wrap {
    @apply max-w-5xl w-full mx-auto px-md;
  }

  main {
    @apply flex-1 max-w-5xl w-full mx-auto px-md;
  }
</style>
