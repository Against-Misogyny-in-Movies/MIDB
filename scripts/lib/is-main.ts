import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * True when the module at `importMetaUrl` is the script Node was started with
 * (`node file.ts`), not an import. Node 22 has no `import.meta.main`.
 * `import.meta.url` is realpathed, so `argv[1]` is too (a symlinked entry path).
 */
export function isMain(importMetaUrl: string): boolean {
	const entry = process.argv[1];
	if (!entry) return false;
	try {
		return realpathSync(path.resolve(entry)) === fileURLToPath(importMetaUrl);
	} catch {
		return false;
	}
}
