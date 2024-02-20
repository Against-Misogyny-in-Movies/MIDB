<script lang="ts">
    export let title: string;
    export let date: string;
    export let description: string;
    
    function formatDate(releaseDate) {
        const date = new Date(releaseDate);
        return date.toDateString().split(' ').slice(1).join(' ');
    }

 
</script>

<div>
    <h2>
        {title}
    </h2>

    <small>{formatDate(date)}</small>

    <p class="description">
        {description}
    </p>
</div>

<style lang="postcss">
    div {
        @apply p-md;
    }

    h2 {
        @apply leading-4 pt-sm;
    }

    small {
        @apply text-neutral;
    }

    p {
        @apply mt-md;
    }
</style>
