import { describe, it, expect } from 'vitest';
import { shouldPreload } from './preload';

describe('shouldPreload', () => {
  const liveThreshold = 600;
  const preloadMargin = 200; // ms

  it('triggers preload when node is growing toward threshold within margin', () => {
    // Node at 500px, growing at 1px/ms -> reaches 600px in 100ms < 200ms margin
    const result = shouldPreload(500, 1, preloadMargin, liveThreshold);
    expect(result).toBe(true);
  });

  it('does not trigger preload when node is shrinking (negative velocity)', () => {
    // Node at 500px but shrinking — velocity is negative
    const result = shouldPreload(500, -1, preloadMargin, liveThreshold);
    expect(result).toBe(false);
  });

  it('does not trigger preload when node is already above threshold', () => {
    // Node already at 700px, above the 600px threshold
    const result = shouldPreload(700, 1, preloadMargin, liveThreshold);
    expect(result).toBe(false);
  });

  it('does not trigger preload when node is far from threshold', () => {
    // Node at 100px, growing at 1px/ms -> reaches 600px in 500ms > 200ms margin
    const result = shouldPreload(100, 1, preloadMargin, liveThreshold);
    expect(result).toBe(false);
  });

  it('does not trigger preload when velocity is zero', () => {
    // Node at 500px, not moving
    const result = shouldPreload(500, 0, preloadMargin, liveThreshold);
    expect(result).toBe(false);
  });

  it('triggers preload at exact margin boundary', () => {
    // Node at 400px, growing at 1px/ms -> reaches 600px in exactly 200ms = margin
    const result = shouldPreload(400, 1, preloadMargin, liveThreshold);
    expect(result).toBe(true);
  });

  it('does not trigger preload when node is at threshold exactly', () => {
    // Node is exactly at the threshold — no preloading needed
    const result = shouldPreload(600, 1, preloadMargin, liveThreshold);
    expect(result).toBe(false);
  });
});
