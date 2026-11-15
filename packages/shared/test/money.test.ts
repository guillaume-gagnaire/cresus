import { describe, expect, it } from 'vitest';
import { formatEuros, parseEuros } from '../src/index.js';

describe('parseEuros', () => {
  it.each([
    ['2,5', 250],
    ['2.50', 250],
    ['2 €', 200],
    [' 1,05€ ', 105],
    ['0', 0],
    ['999,99', 99999],
    ['-1', null],
    ['1000', null],
    ['abc', null],
    ['1,234', null],
    ['', null],
  ])('parseEuros(%j) = %s', (input, cents) => {
    expect(parseEuros(input)).toBe(cents);
  });
});

describe('formatEuros', () => {
  it('formate en euros à la française', () => {
    expect(formatEuros(250)).toBe('2,50\u00a0€');
    expect(formatEuros(123456)).toBe('1\u202f234,56\u00a0€');
  });
});
