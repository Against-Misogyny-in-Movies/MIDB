<script lang="ts">
    import type { ChangeEventHandler, FormEventHandler } from "svelte/elements";
    import Button from "$lib/components/form/button.svelte";

    interface Props {
        method?: "post" | "get";
        action: string;
        onaction?: (query: string) => void;
    }

    let { method = "post", action, onaction }: Props = $props();


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
        onaction?.(query);
    }

</script>

<form {method} {action} onsubmit={handleSubmit}>
    <input type="text" name="query" placeholder="Search..." onchange={handleChange} oninput={handleChange} />
    <Button type="submit">Search <i class="ri-search-line"></i></Button>
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
