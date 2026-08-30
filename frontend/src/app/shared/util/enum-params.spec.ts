import { parseDifficulty, parseMode, parsePage } from './enum-params';

describe('enum-params', () => {
  it('accepts only the exact enum strings', () => {
    expect(parseMode('CLICK')).toBe('CLICK');
    expect(parseMode('TIME')).toBe('TIME');
    expect(parseMode('click')).toBeNull();
    expect(parseMode('BOGUS')).toBeNull();
    expect(parseMode(null)).toBeNull();

    expect(parseDifficulty('MEDIUM')).toBe('MEDIUM');
    expect(parseDifficulty('medium')).toBeNull();
    expect(parseDifficulty(undefined)).toBeNull();
  });

  it('parses a plain positive integer page', () => {
    expect(parsePage('1')).toBe(1);
    expect(parsePage('42')).toBe(42);
    expect(parsePage('007')).toBe(7);
  });

  it('falls back to page 1 for anything that is not a run of digits', () => {
    expect(parsePage(null)).toBe(1);
    expect(parsePage('')).toBe(1);
    expect(parsePage('0')).toBe(1);
    expect(parsePage('-3')).toBe(1);
    expect(parsePage('1.5')).toBe(1);
    expect(parsePage('1e3')).toBe(1);
    expect(parsePage('abc')).toBe(1);
  });

  it('caps an absurd page number', () => {
    expect(parsePage('999999999')).toBe(100_000);
  });
});
