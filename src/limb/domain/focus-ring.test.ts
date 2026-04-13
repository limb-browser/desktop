import { describe, it, expect } from 'vitest';
import { computeFocusRing } from './focus-ring';

describe('computeFocusRing', () => {
  it('focus ring targets the focused node', () => {
    const result = computeFocusRing('node-42', 0.5);

    expect(result.targetNodeId).toBe('node-42');
  });

  it('focus ring is visible at all zoom levels', () => {
    // Test at various zoom levels
    expect(computeFocusRing('node-1', 0.0).visible).toBe(true);
    expect(computeFocusRing('node-1', 0.25).visible).toBe(true);
    expect(computeFocusRing('node-1', 0.5).visible).toBe(true);
    expect(computeFocusRing('node-1', 0.75).visible).toBe(true);
    expect(computeFocusRing('node-1', 0.9).visible).toBe(true);
    expect(computeFocusRing('node-1', 1.0).visible).toBe(true);
  });

  it('focus ring updates when focused node changes', () => {
    const first = computeFocusRing('node-1', 0.5);
    const second = computeFocusRing('node-2', 0.5);

    expect(first.targetNodeId).toBe('node-1');
    expect(second.targetNodeId).toBe('node-2');
    expect(first.targetNodeId).not.toBe(second.targetNodeId);
  });
});
