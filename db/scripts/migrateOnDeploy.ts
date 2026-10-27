import { migrateDatabase } from './migrate';

export type DeployMigration = { skip: string } | { url: string };

/**
 * What a Vercel build does before `build`: Production migrates DB_CONNECTION, every other
 * environment skips, so a preview of an unmerged branch never changes the production schema.
 *
 * @throws when Production has no DB_CONNECTION: the deployment could not serve a title page.
 */
export function deployMigration(env: Record<string, string | undefined>): DeployMigration {
	if (env.VERCEL_ENV !== 'production') {
		return { skip: `VERCEL_ENV is ${env.VERCEL_ENV ?? 'unset'}, not production` };
	}
	if (!env.DB_CONNECTION) {
		throw new Error('DB_CONNECTION is not set for the Production environment on Vercel.');
	}
	return { url: env.DB_CONNECTION };
}

if (import.meta.main) {
	try {
		const step = deployMigration(process.env);
		if ('skip' in step) {
			console.info(`Skipping migrations: ${step.skip}.`);
		} else {
			// One transaction for every pending migration: a failure leaves the database as it
			// was and fails the deployment, so the previous one keeps serving.
			await migrateDatabase(step.url);
			console.info('Migrations applied.');
		}
	} catch (e) {
		console.error(e);
		process.exit(1);
	}
}
