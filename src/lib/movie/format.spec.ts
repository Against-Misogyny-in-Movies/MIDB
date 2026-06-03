import { describe, expect, test } from 'vitest';
import { formatCurrency, formatRuntime, countryName, languageName } from './format';

describe('formatCurrency', () => {
  test('returns — for 0', () => {
    expect(formatCurrency(0)).toBe('—');
  });

  test('formats a real budget', () => {
    expect(formatCurrency(63000000)).toBe('$63,000,000');
  });

  test('returns — for falsy (undefined cast as 0)', () => {
    expect(formatCurrency(0)).toBe('—');
  });
});

describe('formatRuntime', () => {
  test('returns — for 0', () => {
    expect(formatRuntime(0)).toBe('—');
  });

  test('formats hours and minutes', () => {
    expect(formatRuntime(139)).toBe('2h 19m');
  });

  test('formats minutes only when under 1h', () => {
    expect(formatRuntime(45)).toBe('45m');
  });

  test('formats exactly 1 hour', () => {
    expect(formatRuntime(60)).toBe('1h');
  });
});

describe('countryName', () => {
  test('resolves a valid ISO 3166-1 code', () => {
    expect(countryName('US')).toBe('United States');
  });

  test('falls back to raw code for unknown ISO', () => {
    expect(countryName('XX')).toBe('XX');
  });
});

describe('languageName', () => {
  test('resolves a valid BCP 47 code', () => {
    expect(languageName('en')).toBe('English');
  });

  test('falls back to englishName for invalid TMDB code', () => {
    expect(languageName('cn', 'Cantonese')).toBe('Cantonese');
  });

  test('falls back to raw code when no englishName given', () => {
    const result = languageName('xx');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
