<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        collapsed?: boolean;
        children: Snippet;
    }

    let { collapsed = $bindable(true), children }: Props = $props();
</script>

<section>
  <span class="content" class:collapsed>{@render children()}</span>
  <button onclick={() => collapsed = !collapsed}>
    {#if collapsed}
      more <i class="ri-arrow-down-s-line"></i>
    {:else}
      less <i class="ri-arrow-up-s-line"></i>
    {/if}
  </button>
</section>

<style lang="postcss">
	@reference "../../../../app.css";
  section {

    @apply m-md;
    @apply leading-normal;


  }

  section :global(ol) {
    @apply list-decimal;
    @apply list-inside;
    @apply ml-md;
  }

  section :global(ul) {
    @apply list-disc;
    @apply list-inside;
    @apply ml-md;
  }

  section :global(li) {
    @apply mb-sm;
  }

  section :global(p) {
    @apply mb-sm;
  }


  span.content {
    @apply block;
    @apply overflow-hidden;
    transition: max-height 0.3s ease-in-out;
    max-height: 2000px;
    @apply duration-300;

  }

  .content.collapsed {
    @apply max-h-xl;
  }

  button {
    @apply text-ink-muted;
    @apply text-sm;
    @apply font-bold;
    @apply flex items-center;
    @apply mt-sm;
    @apply cursor-pointer;
  }

</style>
