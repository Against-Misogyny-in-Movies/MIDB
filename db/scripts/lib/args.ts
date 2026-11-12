export type ScriptTarget = 'local' | 'remote';

/**
 * Which database a script writes to: `--remote` (D1 over the Cloudflare API) or `--local`
 * (the default, the `.wrangler/state` database). Both together is an error.
 */
export function parseTarget(argv: readonly string[]): ScriptTarget {
	const remote = argv.includes('--remote');
	if (remote && argv.includes('--local')) throw new Error('Pass --local or --remote, not both.');
	return remote ? 'remote' : 'local';
}
