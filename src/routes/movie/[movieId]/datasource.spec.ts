import { describe, expect, test, vi } from 'vitest';

// Mock SvelteKit env before importing the server module
vi.mock('$env/static/public', () => ({ PUBLIC_TMDB_API_URL: 'https://api.themoviedb.org' }));
vi.mock('$env/static/private', () => ({ TMDB_API_TOKEN: 'test-token' }));
vi.mock('@sveltejs/kit', () => ({
  error: (status: number, msg: string) => new Error(`${status}: ${msg}`)
}));

import { aggregateGender } from './datasource.server';

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
