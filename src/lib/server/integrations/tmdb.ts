import { PUBLIC_TMDB_API_URL } from '$env/static/public';
import { TMDB_API_TOKEN } from '$env/static/private';
import type { GenderBreakdown, GenderCategory, CastMember, CrewDepartment, CrewJob } from '$lib/media/types/media';

export const TMDB_BASE = PUBLIC_TMDB_API_URL;

export function tmdbHeaders() {
	return {
		Authorization: `Bearer ${TMDB_API_TOKEN}`,
		accept: 'application/json'
	};
}

export interface TmdbCreditEntry {
	gender: number;
}

export interface TmdbCastEntry extends TmdbCreditEntry {
	name: string;
	order: number;
}

export interface TmdbCrewEntry extends TmdbCreditEntry {
	name: string;
	job: string;
	department: string;
}

export function aggregateGender(entries: TmdbCreditEntry[]): GenderBreakdown {
	const breakdown: GenderBreakdown = { unknown: 0, female: 0, male: 0, nonBinary: 0, total: 0 };
	for (const entry of entries) {
		breakdown.total++;
		if (entry.gender === 1) breakdown.female++;
		else if (entry.gender === 2) breakdown.male++;
		else if (entry.gender === 3) breakdown.nonBinary++;
		else breakdown.unknown++;
	}
	return breakdown;
}

export function genderCategory(n: number): GenderCategory {
	if (n === 1) return 'female';
	if (n === 2) return 'male';
	if (n === 3) return 'nonBinary';
	return 'unknown';
}

export function buildCastMembers(cast: TmdbCastEntry[]): CastMember[] {
	return cast
		.map((c) => ({ name: c.name, gender: genderCategory(c.gender), order: c.order }))
		.sort((a, b) => a.order - b.order);
}

// Departments that carry the most creative influence over a film's voice.
// These float to the top of the crew table and are used by the representation verdict scorer.
export const PRIORITY_DEPARTMENTS = [
	'Directing',
	'Writing',
	'Production',
	'Editing',
	'Camera',
] as const;

export function buildCrewDepartments(crew: TmdbCrewEntry[]): CrewDepartment[] {
	const deptMap = new Map<string, { allEntries: TmdbCreditEntry[]; jobMap: Map<string, TmdbCreditEntry[]> }>();
	for (const c of crew) {
		let dept = deptMap.get(c.department);
		if (!dept) {
			dept = { allEntries: [], jobMap: new Map() };
			deptMap.set(c.department, dept);
		}
		dept.allEntries.push(c);
		const jobEntries = dept.jobMap.get(c.job) ?? [];
		jobEntries.push(c);
		dept.jobMap.set(c.job, jobEntries);
	}
	return Array.from(deptMap.entries())
		.map(([department, { allEntries, jobMap }]) => {
			const jobs: CrewJob[] = Array.from(jobMap.entries())
				.map(([job, entries]) => ({ job, breakdown: aggregateGender(entries) }))
				.sort((a, b) => b.breakdown.total - a.breakdown.total || a.job.localeCompare(b.job));
			return { department, breakdown: aggregateGender(allEntries), jobs };
		})
		.sort((a, b) => {
			const aPriority = PRIORITY_DEPARTMENTS.indexOf(a.department as typeof PRIORITY_DEPARTMENTS[number]);
			const bPriority = PRIORITY_DEPARTMENTS.indexOf(b.department as typeof PRIORITY_DEPARTMENTS[number]);
			// Both priority: sort by declared order
			if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
			// One priority: it goes first
			if (aPriority !== -1) return -1;
			if (bPriority !== -1) return 1;
			// Neither priority: sort by headcount descending
			return b.breakdown.total - a.breakdown.total;
		});
}
