<script>
  import { Hanko } from "@teamhanko/hanko-elements";
  import { goto } from "$app/navigation";
  import { PUBLIC_HANKO_API_URL } from "$env/static/public";

  const hanko = new Hanko(PUBLIC_HANKO_API_URL);
  const logout = () => {
    hanko.user.logout().catch((error) => {
      // handle error
    });
    goto("/login")
  };
</script>

<button on:click={logout}>Logout</button>
