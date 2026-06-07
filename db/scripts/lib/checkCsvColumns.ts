import { createReadStream } from 'fs';
import { parse } from 'csv-parse';

/**
 * Reads only the header row of a CSV and throws if any required column is missing.
 * Call this before opening the main parsing stream so failures are immediate and clear.
 */
export async function checkCsvColumns(csvPath: string, required: string[]): Promise<void> {
	const headers = await readHeaders(csvPath);
	const missing = required.filter((col) => !headers.includes(col));
	if (missing.length > 0) {
		throw new Error(
			`Column check failed for ${csvPath}.\n` +
				`  Missing columns: ${missing.join(', ')}\n` +
				`  Found columns:   ${headers.join(', ')}`
		);
	}
}

async function readHeaders(csvPath: string): Promise<string[]> {
	return new Promise((resolve, reject) => {
		const parser = parse({ columns: false, to_line: 1, trim: true });
		const headers: string[] = [];

		parser.on('readable', () => {
			let row: string[];
			while ((row = parser.read()) !== null) {
				headers.push(...row.map((h) => h.replace(/^"|"$/g, '')));
			}
		});
		parser.on('end', () => resolve(headers));
		parser.on('error', reject);

		createReadStream(csvPath).pipe(parser);
	});
}
