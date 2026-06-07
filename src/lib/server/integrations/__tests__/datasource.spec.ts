import { describe, expect, test, vi } from 'vitest';

// Mock SvelteKit env before importing the server module
vi.mock('$env/static/public', () => ({ PUBLIC_TMDB_API_URL: 'https://api.themoviedb.org' }));
vi.mock('$env/static/private', () => ({ TMDB_API_TOKEN: 'test-token' }));
vi.mock('@sveltejs/kit', () => ({
  error: (status: number, msg: string) => new Error(`${status}: ${msg}`)
}));

import { aggregateGender, buildCastMembers, buildCrewDepartments } from '$lib/server/integrations/tmdb';

describe('aggregateGender', () => {
  test('counts mixed genders', () => {
    const result = aggregateGender([
      { gender: 1 },
      { gender: 1 },
      { gender: 2 },
      { gender: 3 },
      { gender: 0 }
    ]);
    expect(result).toEqual({ female: 2, male: 1, nonBinary: 1, unknown: 1, total: 5 });
  });

  test('returns zeros for empty array', () => {
    const result = aggregateGender([]);
    expect(result).toEqual({ female: 0, male: 0, nonBinary: 0, unknown: 0, total: 0 });
  });

  test('handles missing credits (all unknown)', () => {
    const result = aggregateGender([{ gender: 0 }, { gender: 0 }]);
    expect(result).toEqual({ female: 0, male: 0, nonBinary: 0, unknown: 2, total: 2 });
  });
});

describe('buildCastMembers', () => {
  test('maps gender codes and sorts by order ascending', () => {
    const result = buildCastMembers([
      { name: 'Charlie', gender: 2, order: 2 },
      { name: 'Alice', gender: 1, order: 0 },
      { name: 'Bob', gender: 2, order: 1 },
      { name: 'Dana', gender: 3, order: 3 },
      { name: 'Erin', gender: 0, order: 4 }
    ]);
    expect(result).toEqual([
      { name: 'Alice', gender: 'female', order: 0 },
      { name: 'Bob', gender: 'male', order: 1 },
      { name: 'Charlie', gender: 'male', order: 2 },
      { name: 'Dana', gender: 'nonBinary', order: 3 },
      { name: 'Erin', gender: 'unknown', order: 4 }
    ]);
  });

  test('handles order gaps stably', () => {
    const result = buildCastMembers([
      { name: 'B', gender: 2, order: 10 },
      { name: 'A', gender: 1, order: 5 }
    ]);
    expect(result[0].name).toBe('A');
    expect(result[1].name).toBe('B');
  });

  test('returns empty array for empty input', () => {
    expect(buildCastMembers([])).toEqual([]);
  });
});

describe('buildCrewDepartments', () => {
  test('groups into departments with nested jobs', () => {
    const result = buildCrewDepartments([
      { name: 'Alice', gender: 1, job: 'Director', department: 'Directing' },
      { name: 'Bob', gender: 2, job: 'Director', department: 'Directing' },
      { name: 'Carol', gender: 1, job: 'Producer', department: 'Production' }
    ]);
    const directing = result.find((d) => d.department === 'Directing');
    const production = result.find((d) => d.department === 'Production');
    expect(directing).toBeDefined();
    expect(directing!.breakdown).toEqual({ female: 1, male: 1, nonBinary: 0, unknown: 0, total: 2 });
    expect(directing!.jobs).toHaveLength(1);
    expect(directing!.jobs[0].job).toBe('Director');
    expect(production).toBeDefined();
    expect(production!.breakdown).toEqual({ female: 1, male: 0, nonBinary: 0, unknown: 0, total: 1 });
  });

  test('priority departments float to the top in declared order, rest sort by headcount', () => {
    const result = buildCrewDepartments([
      { name: 'A', gender: 2, job: 'Editor', department: 'Editing' },
      { name: 'B', gender: 2, job: 'Director', department: 'Directing' },
      { name: 'C', gender: 1, job: 'Director', department: 'Directing' },
      { name: 'D', gender: 1, job: 'Producer', department: 'Production' },
      { name: 'E', gender: 2, job: 'Producer', department: 'Production' },
      { name: 'F', gender: 1, job: 'Executive Producer', department: 'Production' },
      { name: 'G', gender: 2, job: 'Stunt Coordinator', department: 'Stunts' },
      { name: 'H', gender: 2, job: 'Stunt Coordinator', department: 'Stunts' },
      { name: 'I', gender: 2, job: 'Stunt Coordinator', department: 'Stunts' },
      { name: 'J', gender: 2, job: 'Stunt Coordinator', department: 'Stunts' },
    ]);
    // Priority order: Directing (idx 0) < Production (idx 2) < Editing (idx 3)
    // Stunts (4 entries, non-priority) sorts after all priority depts
    expect(result[0].department).toBe('Directing');
    expect(result[1].department).toBe('Production');
    expect(result[2].department).toBe('Editing');
    expect(result[3].department).toBe('Stunts');
  });

  test('sorts jobs within a department by total descending', () => {
    const result = buildCrewDepartments([
      { name: 'A', gender: 1, job: 'Producer', department: 'Production' },
      { name: 'B', gender: 2, job: 'Producer', department: 'Production' },
      { name: 'C', gender: 1, job: 'Executive Producer', department: 'Production' }
    ]);
    const prod = result.find((d) => d.department === 'Production')!;
    expect(prod.jobs[0].job).toBe('Producer');       // total=2
    expect(prod.jobs[1].job).toBe('Executive Producer'); // total=1
  });

  test('returns empty array for empty input', () => {
    expect(buildCrewDepartments([])).toEqual([]);
  });

  test('department breakdown aggregates all job entries (person counted once per job)', () => {
    const result = buildCrewDepartments([
      { name: 'Alice', gender: 1, job: 'Writer', department: 'Writing' },
      { name: 'Alice', gender: 1, job: 'Story Editor', department: 'Writing' }
    ]);
    // Alice has 2 job entries in Writing → dept total = 2
    const writing = result.find((d) => d.department === 'Writing')!;
    expect(writing.breakdown.total).toBe(2);
    expect(writing.breakdown.female).toBe(2);
    expect(writing.jobs).toHaveLength(2);
  });
});
