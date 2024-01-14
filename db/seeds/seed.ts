import LoomFs, {type File} from '@loom-io/fs';
import db from '../connections';
import { metricOptions, metrics } from '../schema/metric';


const production = process.env.NODE_ENV === 'production';

type NewMetric = typeof metrics.$inferInsert;
type NewMetricOption = typeof metricOptions.$inferInsert;


async function handleMetricSeed (data: Record<string, unknown>) {
  if(!data.id || !data.name || !data.shortDescription || !data.description || !data.options) {
    throw new Error('Missing required fields');
  }
  const { options, ...metric } = data;
  const metricId = await insertMetric((metric as NewMetric));
  const metricOptions = (options as Array<Omit<NewMetricOption, 'metricId'>>).map<NewMetricOption>((option: Record<string, unknown>) => {
    return {
      ...option,
      metricId
    }
  });
  await insertMetricOptions(metricOptions);
}

async function insertMetric (data: NewMetric) {
  await db.insert(metrics).values(data).execute();
  return data.id;
}

async function insertMetricOptions (data: NewMetricOption[]) {
  await db.insert(metricOptions).values(data).execute();
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
main();
