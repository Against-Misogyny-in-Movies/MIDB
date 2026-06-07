<script lang="ts" module>
  import { PUBLIC_TMDB_IMAGE_URL } from '$env/static/public';
  const sizes = [200, 300, 400, 500];
</script>

<script lang="ts">
  interface Props {
      src: string;
      alt: string;
      imgSizes?: string;
  }

  let { src, alt, imgSizes }: Props = $props();

  function getLink(size: number | 'original' = 500) {
    const parts: string[] = [
      PUBLIC_TMDB_IMAGE_URL ?? '',
      size === 'original' ? 'original' : `w${size}`,
      src ?? ''
    ];

    return parts.map((part) => {
      let newPath = part;
      if(part.endsWith('/')) {
        newPath = part.slice(0, -1);
      }
      if(part.startsWith('/')) {
        newPath = part.slice(1);
      }
      return newPath;
    }).join('/');
  }

  function getSrcSet() {
    const sets = sizes.map((size) => {
      return `${getLink(size)} ${size}w`;
    });
    const sizeForOriginal = sizes[sizes.length-1] + 200;
    sets.push(`${getLink('original')} ${sizeForOriginal}w`);
    return sets.join(', ');
  }
</script>

<img src={getLink(500)} srcset={getSrcSet()} sizes={imgSizes} {alt} decoding="async" />

<style lang="postcss">
	@reference "../../../../app.css";
  img {
    @apply h-full;
  }
</style>
