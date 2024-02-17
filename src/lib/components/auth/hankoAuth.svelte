

<script lang="ts">
  import { onMount } from "svelte";
  import { register } from "@teamhanko/hanko-elements";
  import { PUBLIC_HANKO_API_URL} from '$env/static/public'

  

  onMount(async () => {
    try {
      await register(PUBLIC_HANKO_API_URL);
    } catch (error) {
      console.error(error);
    }
  });
</script>

<hanko-auth on:onAuthFlowCompleted/>
