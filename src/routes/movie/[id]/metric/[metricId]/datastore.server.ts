import db from '$db/connections'
import { sql } from 'drizzle-orm'

const getMetricOptionsPreparedQuery = db.query.metricOptions.findMany({
  columns: {
    id: true,
    name: true,
    shortDescription: true,
  },
  where: (metricOptions, {eq}) => eq(metricOptions.metricId, sql.placeholder('metricId'))
}).prepare('getMetricOptionsByMetricId')

const getMetricWithOptionsPreparedQuery = db.query.metrics.findFirst({
  columns: {
    id: true,
    name: true,
    shortDescription: true,
    description: true,
    relatedOptions: true,
  },
  with: {
    options: {
      columns: {
        id: true,
        name: true,
        shortDescription: true,
      }
    }
  },
  where: (metrics, {eq}) => eq(metrics.id, sql.placeholder('metricId'))
}).prepare('getMetricWithOptionsByMetricId')

export const getMetricWithOptions = (metric: string) => {
  return getMetricWithOptionsPreparedQuery.execute({metricId: metric})
}

export const getMetricOptions = (metric: string) => {
  return getMetricOptionsPreparedQuery.execute({metricId: metric})
}
