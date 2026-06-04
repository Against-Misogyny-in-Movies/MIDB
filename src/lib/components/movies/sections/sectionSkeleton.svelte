<script lang="ts">
  import Skeleton from '$lib/components/ui/feedback/skeleton.svelte';

  interface Props {
    variant: 'metrics' | 'comments';
  }

  let { variant }: Props = $props();

  const rows = [0, 1, 2];
</script>

{#if variant === 'metrics'}
  <div class="metrics-skeleton" aria-hidden="true">
    {#each rows as i (i)}
      <div class="metric-tile">
        <Skeleton static height="1rem" width="60%" />
        <Skeleton static height="3rem" />
        <Skeleton static height="0.75rem" width="40%" />
      </div>
    {/each}
  </div>
{:else if variant === 'comments'}
  <div class="comments-skeleton" aria-hidden="true">
    {#each rows as i (i)}
      <div class="comment-row">
        <Skeleton static width="2rem" height="2rem" rounded="rounded-full" />
        <div class="comment-lines">
          <Skeleton static height="0.75rem" width="40%" />
          <Skeleton static height="0.75rem" width="70%" />
        </div>
      </div>
    {/each}
  </div>
{/if}

<style lang="postcss">
  @reference "../../../../app.css";

  .metrics-skeleton {
    @apply grid gap-md;
    grid-template-columns: repeat(3, 1fr);
    min-height: 8rem;
  }

  .metric-tile {
    @apply flex flex-col gap-sm p-md rounded-md bg-surface-raised;
  }

  .comments-skeleton {
    @apply flex flex-col gap-md;
    min-height: 10rem;
  }

  .comment-row {
    @apply flex items-start gap-sm;
  }

  .comment-lines {
    @apply flex flex-col gap-xs flex-1;
  }
</style>
