<script lang="ts">
  import { Hanko } from "@teamhanko/hanko-elements";
  import { goto } from "$app/navigation";
  import { PUBLIC_HANKO_API_URL } from "$env/static/public";

  const hanko = new Hanko(PUBLIC_HANKO_API_URL);
  const logout = () => {
    hanko.logout().catch((_) => {
      // handle error
    });
    goto("/auth")
  };
</script>

<button onclick={logout}>Logout</button>
