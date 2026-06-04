<script lang="ts">
  interface Props {
    width?: string;
    height?: string;
    rounded?: string;
    // When true, render a static tint instead of the shimmer animation. Use for
    // placeholders that are not actively loading (e.g. the sections 3/4 stubs that
    // won't stream until a later plan) so the page isn't running a forever-animation.
    static?: boolean;
  }

  let { width = '100%', height = '1rem', rounded = 'rounded-md', static: isStatic = false }: Props = $props();
</script>

<div
  class="skeleton {rounded}"
  class:animated={!isStatic}
  style="width: {width}; height: {height};"
  aria-hidden="true"
></div>

<style lang="postcss">
  @reference "../../../../app.css";

  .skeleton {
    @apply bg-border;
  }

  @media (prefers-reduced-motion: no-preference) {
    .skeleton.animated {
      background: linear-gradient(
        90deg,
        var(--border) 25%,
        var(--surface-raised) 50%,
        var(--border) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
  }

  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>
