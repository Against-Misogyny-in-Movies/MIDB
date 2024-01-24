<script lang="ts">

  export let collapsed: boolean = true;
</script>

<section>
  <span class="content" class:collapsed><slot /></span>
  <button on:click={() => collapsed = !collapsed}>
    {#if collapsed}
      more <i class="ri-arrow-down-s-line"></i>
    {:else}
      less <i class="ri-arrow-up-s-line"></i>
    {/if}
  </button>
</section>

<style lang="postcss">
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
    @apply transition-all;
    @apply duration-300;

  }

  .content.collapsed {
    @apply h-xl
  }

  button {
    @apply text-neutral;
    @apply text-sm;
    @apply font-bold;
    @apply flex items-center;
    @apply mt-sm;
    @apply cursor-pointer;
  }

</style>