<script lang="ts">
    import type { Snippet } from 'svelte';
    import { setAttributesToChilds } from "$lib/actions/setAttributesToChilds";
    import Progressbar from "../visualization/progressbar.svelte";

    interface Props {
        detailed?: boolean;
        children: Snippet;
    }

    let { detailed = true, children }: Props = $props();

    let current = $state(0);
    let total: number = $state(0);

    export function reset() {
        current = 0;
    }


    function isCheckbox(element: HTMLElement | ChildNode): element is HTMLInputElement {
        return element.nodeName === 'INPUT' && (element as HTMLInputElement).type === 'checkbox';
    }

    function deselectFollowingSiblings(element: HTMLElement | ChildNode) {
        const previous= element.nextSibling as HTMLElement;
        if(previous) {
            if(isCheckbox(previous)) {
                const input = previous as HTMLInputElement;
                input.checked = false;
            }

            deselectFollowingSiblings(previous);
        }
    }

    function selectPreviousSiblings(element: HTMLElement) {
        const previous= element.previousSibling as HTMLInputElement;
        if(previous) {
            if(isCheckbox(previous)) {
                const input = previous as HTMLInputElement;
                input.checked = true;
            }

            selectPreviousSiblings(previous);
        }
    }


    function handleChange(event: Event) {
        const target = event.target as HTMLInputElement;
        if(target.type === 'checkbox') {
            const currentElementNumber = Number(target.getAttribute('data-tile-number'));
            if(target.checked) {
                selectPreviousSiblings(target);
                current = currentElementNumber;
            } else {
                if(currentElementNumber !== current){
                    target.checked = true;
                    current = currentElementNumber;
                } else {
                    current = currentElementNumber - 1;
                }
                deselectFollowingSiblings(target);
            }

        }
    }


</script>

<div class="tile-grid" onreset={() => console.log("rest")} onchange={handleChange} use:setAttributesToChilds={{
    selector: 'input[type="checkbox"]',
    attribute: 'data-tile-number',
    value: () => ++total
}}>
    <Progressbar {current} {total} vertical></Progressbar>
    <div class="tiles" class:detailed>{@render children()}</div>
</div>


<style lang="postcss">
	@reference "../../../app.css";

    div.tile-grid {
        @apply grid grid-cols-2 gap-md items-center w-full;
        grid-template-columns: auto 1fr;
    }

    div.tile-grid > :global(.progressbar) {
        @apply justify-self-end;
    }

    div.tiles {
        @apply grid grid-cols-1 gap-md;
    }

    div.tiles:not(.detailed) > :global(.tile) {
        @apply truncate;
    }
</style>
