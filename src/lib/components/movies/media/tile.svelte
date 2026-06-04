<script lang="ts">
  import Description from "$lib/components/movies/sections/description.svelte";
  import Image from "./image.svelte";

  interface Props {
      title: string;
      date: string;
      description: string;
      image: string;
      logo?: string | false;
      small?: boolean;
  }

  let {
      title,
      date,
      description,
      image,
      logo = 'https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_1-5bdc75aaebeb75dc7ae79426ddd9be3b2be1e342510f8202baf6bffa71d7f5c4.svg',
      small = false
  }: Props = $props();
</script>

<section class:small>
  <Image src={image} alt={title} />
  <Description {title} {date} {description} />
  {#if logo}
    <img class="source" src={logo} alt="The Movie Database Logo" />
  {/if}
</section>

<style lang="postcss">
	@reference "../../../../app.css";
  section {
    @apply relative flex flex-row overflow-hidden ;
    @apply p-sm rounded-md bg-surface-raised shadow-md;
    height: var(--height, 30%);
  }

  section:not(.small) {
    @apply p-md;
  }

  section.small {
    height: 5rem;
  }

  section.small :global(.description) {
    @apply line-clamp-4;
  }

  .source {
    @apply absolute bottom-0 right-0;
    @apply h-md m-sm;
  }

</style>
