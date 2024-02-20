<script lang="ts">
    import 'remixicon/fonts/remixicon.css'
    import "../app.css";
</script>

<main>
    <slot />
</main>


<style lang="postcss">
    main {
        @apply p-md;
    }
</style>