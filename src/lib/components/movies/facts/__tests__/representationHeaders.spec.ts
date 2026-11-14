import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CastRepresentation from '../castRepresentation.svelte';
import CrewRepresentation from '../crewRepresentation.svelte';

afterEach(cleanup);

const NAMES = ['Women', 'Men', 'Non-binary', 'Unknown'];

describe('representation table headers', () => {
	it('give screen readers the full gender name, not the abbreviation', () => {
		render(CastRepresentation, {
			castMembers: [{ name: 'A', gender: 'female', order: 0 }]
		});
		for (const name of NAMES) expect(screen.getByRole('columnheader', { name })).toBeTruthy();
	});

	it('do the same in the crew table', () => {
		render(CrewRepresentation, {
			crewDepartments: [
				{
					department: 'Directing',
					breakdown: { female: 1, male: 0, nonBinary: 0, unknown: 0, total: 1 },
					jobs: []
				}
			]
		});
		for (const name of NAMES) expect(screen.getByRole('columnheader', { name })).toBeTruthy();
	});
});
