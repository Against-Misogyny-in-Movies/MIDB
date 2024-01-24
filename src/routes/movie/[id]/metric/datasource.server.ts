import db from '$db/connections'

const getAllMetricsQuery = db.query.metrics.findMany({
    columns: {
        id: true,
        name: true,
        shortDescription: true,
        description: true
    },
})

export const getAllMetrics = () => {
    return getAllMetricsQuery.execute()
}