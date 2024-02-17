<script>
  import { register } from "@teamhanko/hanko-elements";
  import { onMount } from "svelte";
  import { PUBLIC_HANKO_API_URL } from "$env/static/public";

  onMount(async () => {
    register(PUBLIC_HANKO_API_URL).catch((error) => {
      // handle error
    });
  });
</script>

<hanko-profile />
