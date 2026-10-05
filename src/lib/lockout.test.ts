import { describe, expect, it } from 'vitest';
import { lockoutSecondsForFailures } from './lockout';

describe('lockoutSecondsForFailures', () => {
  it('does not lock the first four failures', () => {
    expect(lockoutSecondsForFailures(0)).toBe(0);
    expect(lockoutSecondsForFailures(4)).toBe(0);
  });

  it('doubles the wait from the fifth failure and caps at 32 minutes', () => {
    expect(lockoutSecondsForFailures(5)).toBe(60);
    expect(lockoutSecondsForFailures(6)).toBe(120);
    expect(lockoutSecondsForFailures(7)).toBe(240);
    expect(lockoutSecondsForFailures(10)).toBe(32 * 60);
    expect(lockoutSecondsForFailures(20)).toBe(32 * 60);
  });
});
