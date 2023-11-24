<script lang="ts" context="module">
	import { Template, Story } from '@storybook/addon-svelte-csf';

    import SearchForm from './searchForm.svelte';
    
    export const meta = {
        title: 'Components/Search/SearchForm',
        component: SearchForm,
        argTypes: {},
        parameters: {
            layout: 'centered',
        },
    };

</script>

<script lang="ts">
	import { createDebouncedSearchStore } from "$lib/stores/debounced";

    const ref = { quries: []}
    let apiFunction = (query: string) => Promise.resolve([query, ...ref.quries]);

    const search = createDebouncedSearchStore(apiFunction, 750);
    search.subscribe((value) => {
        ref.quries = value;
    });
    function handleAction (customEvent: CustomEvent<string>) {
        search.search(customEvent.detail);
    }

</script>

<Template let:args>
    <SearchForm on:action={handleAction}></SearchForm>
    {#each $search as res, i (i)}
        <p>{res}</p>
    {/each}
</Template>

<Story name = "Search">

</Story>