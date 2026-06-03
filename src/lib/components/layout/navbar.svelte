<script lang="ts">
  import ThemeToggle from '$lib/components/theme/themeToggle.svelte';
</script>

<nav>
  <a href="/" class="display wordmark">MIDB</a>
  <div class="actions">
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
    @apply text-brand text-xl font-semibold no-underline;
  }

  .actions {
    @apply flex items-center gap-md;
  }

  .signin {
    @apply text-ink-muted no-underline;
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
