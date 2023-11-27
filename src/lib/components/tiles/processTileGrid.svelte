<script lang="ts">
	import { setAttributesToChilds } from "$lib/actions/setAttributesToChilds";
	import Processbar from "../visualitation/processbar.svelte";


    export let detailed: boolean = true;
    let current = 0;
    let total: number = 0;


    function deseletFollowingSiblings(element: HTMLElement) {
        const previous= element.nextSibling as HTMLElement;
    ;
        if(previous) {
            if(previous.getAttribute('type') === 'checkbox') {
                const input = previous as HTMLInputElement;
                input.checked = false;
            }

            deseletFollowingSiblings(previous);
        }
    }

    function selectPreviousSiblings(element: HTMLElement) {
        const previous= element.previousSibling as HTMLElement;
        if(previous) {
            if(previous.getAttribute('type') === 'checkbox') {
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
                deseletFollowingSiblings(target);
            }
            
        }
    }

</script>

<div class="tile-grid" class:detailed on:change={handleChange} use:setAttributesToChilds={{
    selector: 'input[type="checkbox"]',
    attribute: 'data-tile-number',
    value: () => ++total
}}>
    <Processbar {current} {total} horizontal></Processbar>
    <div class="tiles"><slot></slot></div>
</div>


<style lang="postcss">
    div.tile-grid {
        @apply grid grid-cols-2 gap-md items-center w-full;
        grid-template-columns: auto 1fr;
    }

    div.tile-grid > :global(.processbar) {
        @apply justify-self-end;
    }

    div.tiles {
        @apply grid grid-cols-1 gap-md;
    }

    div:not(.detailed) > :global(.tile) {
        @apply truncate;
    }
</style>