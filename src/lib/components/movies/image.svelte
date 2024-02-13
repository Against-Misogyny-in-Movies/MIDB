<script lang="ts">
	import { PUBLIC_TMDB_IMAGE_URL } from '$env/static/public';

  const sizes = [200, 300, 400, 500];
  export let src: string;
  export let alt: string;

  function getLink(size: number | 'original' = 500) {

    const parts: string[] = [
      PUBLIC_TMDB_IMAGE_URL,
      size === 'original' ? 'original' : `w${size}`,
      src
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
    const sets =  sizes.map((size) => {
      return `${getLink(size)} ${size}w`;
    });
    const sizeForOriginal = sizes[sizes.length-1] + 200;
    sets.push(`${getLink('original')} ${sizeForOriginal}w`);
    return sets.join(', ');
  }


  
</script>

<img src={getLink('original')} srcset={getSrcSet()} {alt}/>

<style lang="postcss">
  
</style>