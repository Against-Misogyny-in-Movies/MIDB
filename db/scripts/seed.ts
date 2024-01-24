import LoomFs, {type File} from '@loom-io/fs';
import type { PgTable } from 'drizzle-orm/pg-core/table.d';
import type { PgInsertValue } from 'drizzle-orm/pg-core/query-builders/insert.d';
import db from '../connections';
import { metricOptions, metrics } from '../schema/metric';
import { SQL, eq } from 'drizzle-orm';


const production = process.env.NODE_ENV === 'production';

type NewMetric = typeof metrics.$inferInsert;
type NewMetricOption = typeof metricOptions.$inferInsert;

enum InsertOrUpdate {
  Insert,
  Update
}

async function handleMetricSeed (data: Record<string, unknown>) {
  if(!(data.id || data.name || data.shortDescription || data.description || data.options)) {
    throw new Error('Missing required fields');
  }
  const { options, ...metricData } = data;
  const metricCondition = () => eq(metrics.id,(metricData as NewMetric).id);
  const insertOrUpdateResult = await insertOrUpdate(metrics, (metricData as NewMetric), metricCondition);
  const metricOptionData = (options as Array<Omit<NewMetricOption, 'metricId'>>).map<NewMetricOption>((option: Record<string, unknown>) => {
    return {
      ...option,
      metricId: (metricData as NewMetric).id
    }
  });

  if(insertOrUpdateResult === InsertOrUpdate.Insert) {
    await insert(metricOptions, metricOptionData);
  } else {
    const condition = () => eq(metricOptions.metricId, (metricData as NewMetric).id);
    await deleteAndInsert(metricOptions, metricOptionData, condition);
  }
}

async function insertOrUpdate<T extends PgTable, U extends PgInsertValue<T>> (schema: T, data: U, condition: () => SQL) {
  try {
    await db.insert(schema).values(data).execute();
    return InsertOrUpdate.Insert;
  } catch (e) {
    await db.update(schema).set(data).where(condition()).execute();
    return InsertOrUpdate.Update;
  }
}

async function insert<T extends PgTable, U extends PgInsertValue<T>> (schema: T, data: U[]) {
  await db.insert(schema).values(data).execute();
}

async function deleteAndInsert<T extends PgTable, U extends PgInsertValue<T>> (schema: T, data: U[], condition: () => SQL) {
  await db.delete(schema).where(condition()).execute();
  await insert(schema, data);
}


async function main () {
  const mainDir = LoomFs.dir('./db/seeds');
  const workDir = production ? mainDir.subdir('prod') : mainDir;
  const files = await workDir.files(true);

  const metrics = files.filter(wrap => wrap.path.includes('metrics'));

  for(const metric of metrics) {
    const json = await (metric as File).json<Record<string, unknown>>();
    await handleMetricSeed(json);
  }
}

// run the script
await main();

// exit
process.exit(0);


