<script lang="ts">
    export let title: string;
    export let date: Date;
    export let description: string;
    
    const formattedDate = date.toDateString().split(' ').slice(1).join(' ');
</script>

<div>
    <h2>
        {title}
    </h2>

    <small>{formattedDate}</small>

    <p class="description">
        {description}
    </p>
</div>

<style lang="postcss">
    div {
        @apply p-md;
    }

    h2 {
        @apply leading-4;
    }

    small {
        @apply text-neutral;
    }

    p {
        @apply mt-sm;
    }
</style>
