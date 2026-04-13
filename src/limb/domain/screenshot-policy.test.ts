import { describe, it, expect } from 'vitest';
import { shouldCapture, type CaptureEvent } from './screenshot-policy';

describe('shouldCapture', () => {
  it('returns true for first-load', () => {
    expect(shouldCapture('first-load')).toBe(true);
  });

  it('returns true for title-change', () => {
    expect(shouldCapture('title-change')).toBe(true);
  });

  it('returns true for eviction', () => {
    expect(shouldCapture('eviction')).toBe(true);
  });

  it('returns false for scroll', () => {
    expect(shouldCapture('scroll')).toBe(false);
  });

  it('returns false for dom-mutation', () => {
    expect(shouldCapture('dom-mutation')).toBe(false);
  });
});
