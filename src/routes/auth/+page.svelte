<script lang="ts">
	import { goto } from '$app/navigation';
	import HankoAuth from '$lib/components/auth/hankoAuth.svelte';

  const redirectAfterLogin = () => {
    goto("/user/dashboard");
  };
</script>

<HankoAuth on:onAuthFlowCompleted={redirectAfterLogin}/>