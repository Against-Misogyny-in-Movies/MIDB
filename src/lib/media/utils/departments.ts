// Departments that carry the most creative influence over a title's voice.
// They float to the top of the crew table (TMDB mappers) and are the ones the
// representation verdict scores (verdict.ts).
export const PRIORITY_DEPARTMENTS = [
	'Directing',
	'Writing',
	'Production',
	'Editing',
	'Camera'
] as const;

export type PriorityDepartment = (typeof PRIORITY_DEPARTMENTS)[number];
