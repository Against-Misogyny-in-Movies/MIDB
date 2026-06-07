<script lang="ts">
  import { page } from '$app/stores';
  import ThemeToggle from '$lib/components/theme/themeToggle.svelte';
  import NavbarSearch from './navbarSearch.svelte';

  const showSearch = $derived($page.url.pathname !== '/');
</script>

<nav>
  <a href="/" class="display wordmark">MIDB</a>
  <div class="actions">
    {#if showSearch}
      <NavbarSearch />
    {/if}
    <ThemeToggle />
    <a href="/auth" class="label signin">Sign in</a>
  </div>
</nav>

<style lang="postcss">
  @reference "../../../app.css";

  nav {
    @apply flex items-center justify-between py-md;
    @apply border-b border-border;
  }

  .wordmark {
    @apply text-brand text-xl font-semibold no-underline shrink-0;
  }

  .actions {
    @apply flex items-center gap-md min-w-0;
  }

  .signin {
    @apply text-ink-muted no-underline shrink-0;
  }

  .signin:hover {
    @apply text-brand;
  }

  @media (max-width: 479px) {
    .signin {
      display: none;
    }
  }
</style>
