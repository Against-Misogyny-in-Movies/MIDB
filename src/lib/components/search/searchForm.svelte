<script lang="ts">

    import { createEventDispatcher } from "svelte";
    import type { ChangeEventHandler, FormEventHandler } from "svelte/elements";
	import Button from "$lib/components/form/button.svelte";

    export let method: "post" | "get" = "post";
    export let action: string;


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

<form {method} {action} on:submit on:submit={handleSubmit}>
    <input type="text" name="query" placeholder="Search..." on:change on:input={handleChange} />
    <Button type="submit">Search <i class="ri-search-line" /></Button>
</form>

<style lang="postcss">
    form {
        @apply flex flex-row bg-white rounded-md p-xs border-2 border-neutral-light;
    }

    input {
        @apply flex-1;
    }

    form:focus-within {
        @apply border-primary;
    }

    input:focus {
        @apply outline-none;
    }
</style>