<script lang="ts">
  import Description from "./description.svelte";
  import Image from "./image.svelte";

  export let title: string;
  export let date: Date;
  export let description: string;
  export let image: string;
  export let logo: string | false | undefined = 'https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_1-5bdc75aaebeb75dc7ae79426ddd9be3b2be1e342510f8202baf6bffa71d7f5c4.svg'
  export let small: boolean = false;
</script>

<section class:small>
  <Image src={image} alt={title} />
  <Description {title} {date} {description} />
  {#if logo}
    <img class="source" src={logo} alt="The Movie Database Logo" />
  {/if}
</section>

<style lang="postcss">
  section {
    @apply relative flex flex-row overflow-hidden ;
    @apply p-sm rounded-md bg-white shadow-md;
    height: var(--height, 30%);
  }

  section:not(.small) {
    @apply p-md;
  }

  section.small {
    @apply h-element-sm;
  }

  section.small :global(.description) {
    @apply line-clamp-4;
  }

  .source {
    @apply absolute bottom-0 right-0;
    @apply h-md m-sm;
  }

</style>



