<script lang="ts">
    

</script>


<nav>
    <ul>
        <slot />
    </ul>
</nav>

<style lang="postcss">
    nav {
        @apply my-sm mx-md;
    }

    ul {
        @apply flex space-x-md;
    }
</style>