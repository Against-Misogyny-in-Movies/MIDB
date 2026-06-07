<script lang="ts">
    interface Props {
        title: string;
        date: string;
        description: string;
    }

    let { title, date, description }: Props = $props();

    function formatDate(releaseDate: string) {
        const d = new Date(releaseDate);
        return d.toDateString().split(' ').slice(1).join(' ');
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
	@reference "../../../../app.css";
    div {
        @apply p-md;
    }

    h2 {
        @apply leading-4 pt-sm;
    }

    small {
        @apply text-ink-muted;
    }

    p {
        @apply mt-md;
    }
</style>
