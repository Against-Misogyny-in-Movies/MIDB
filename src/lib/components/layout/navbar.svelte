<script lang="ts">
  import { page } from '$app/stores';
  import ThemeToggle from '$lib/components/theme/themeToggle.svelte';
  import NavbarSearch from './navbarSearch.svelte';
  import NavbarMenu from './navbarMenu.svelte';

  const showSearch = $derived($page.url.pathname !== '/');
</script>

<nav>
  <a href="/" class="display wordmark">MIDB</a>
  <div class="actions">
    {#if showSearch}
      <NavbarSearch />
    {/if}
    <div class="links">
      <a href="/resources" class="label nav-link">Resources</a>
      <a href="/blog" class="label nav-link">Blog</a>
      <a href="/about" class="label nav-link">About us</a>
      <a href="/auth" class="label nav-link">Sign in</a>
    </div>
    <ThemeToggle />
    <NavbarMenu />
  </div>
</nav>

<style lang="postcss">
  @reference "../../../app.css";

  nav {
    @apply flex items-center justify-between gap-md py-md;
    @apply border-b border-border;
  }

  .wordmark {
    @apply text-brand text-xl font-semibold no-underline shrink-0;
  }

  .actions {
    @apply flex items-center gap-md min-w-0;
  }

  .nav-link {
    @apply text-ink-muted no-underline shrink-0;
  }

  .nav-link:hover {
    @apply text-brand;
  }

  /* Below md the text links collapse into the NavbarMenu dropdown; the bar keeps
     the search trigger, theme toggle, and hamburger. */
  .links {
    @apply contents;
  }

  @media (max-width: 767px) {
    .links {
      display: none;
    }
  }
</style>
