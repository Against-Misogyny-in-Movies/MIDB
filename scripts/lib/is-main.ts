import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * True when the module at `importMetaUrl` is the script Node was started with
 * (`node file.ts`), not an import. Node 22 has no `import.meta.main`.
 */
export function isMain(importMetaUrl: string): boolean {
	const entry = process.argv[1];
	return Boolean(entry) && path.resolve(entry) === fileURLToPath(importMetaUrl);
}
