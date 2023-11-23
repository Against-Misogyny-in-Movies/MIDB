<script lang="ts">

    import { createEventDispatcher } from "svelte";
    import type { ChangeEventHandler, FormEventHandler } from "svelte/elements";


    const actionEmmiter = createEventDispatcher();


    const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const query = formData.get("query") as string;
        handleAction(query);
    }

    const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
        const target = event.target as HTMLInputElement;
        const query = target.value;
        handleAction(query);
    }

    function handleAction (query: string) {
        actionEmmiter("action", query );
    }

</script>

<form method="post" on:submit on:submit={handleSubmit}>
    <input type="text" name="query" placeholder="Search..." on:change on:change={handleChange} />
    <button type="submit">Search</button>
</form>