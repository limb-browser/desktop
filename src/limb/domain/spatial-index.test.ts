import { describe, it, expect } from 'vitest';
import { SpatialIndex } from './spatial-index';

describe('SpatialIndex', () => {
  it('insert and query finds nodes in rect', () => {
    const index = new SpatialIndex(1);

    index.insert('a', 2, 3);
    index.insert('b', 2.5, 3.5);

    const result = index.queryRect(1, 2, 3, 3);
    expect(result).toContain('a');
    expect(result).toContain('b');
  });

  it('nodes outside rect are not returned', () => {
    const index = new SpatialIndex(1);

    index.insert('inside', 5, 5);
    index.insert('outside', 20, 20);

    const result = index.queryRect(4, 4, 3, 3);
    expect(result).toContain('inside');
    expect(result).not.toContain('outside');
  });

  it('remove makes node unfindable', () => {
    const index = new SpatialIndex(1);

    index.insert('a', 2, 3);
    expect(index.queryRect(1, 2, 3, 3)).toContain('a');

    index.remove('a');
    expect(index.queryRect(1, 2, 3, 3)).not.toContain('a');
  });

  it('handles nodes at exact cell boundaries', () => {
    const index = new SpatialIndex(10);

    index.insert('origin', 0, 0);
    index.insert('boundary', 10, 10);

    const result = index.queryRect(0, 0, 10, 10);
    expect(result).toContain('origin');
    // boundary is at (10,10), rect is [0,10)x[0,10) — boundary is at the edge
    // queryRect includes the right/bottom edges
    expect(result).toContain('boundary');
  });

  it('returns empty array when no nodes in rect', () => {
    const index = new SpatialIndex(1);

    index.insert('a', 100, 100);

    const result = index.queryRect(0, 0, 5, 5);
    expect(result).toHaveLength(0);
  });

  it('handles removal of non-existent node gracefully', () => {
    const index = new SpatialIndex(1);
    // Should not throw
    index.remove('nonexistent');
  });

  it('re-inserting a node updates its position', () => {
    const index = new SpatialIndex(1);

    index.insert('a', 2, 3);
    expect(index.queryRect(1, 2, 3, 3)).toContain('a');

    // Move the node far away
    index.insert('a', 50, 50);
    expect(index.queryRect(1, 2, 3, 3)).not.toContain('a');
    expect(index.queryRect(49, 49, 3, 3)).toContain('a');
  });

  it('does not return duplicate node IDs', () => {
    const index = new SpatialIndex(1);

    index.insert('a', 2, 3);

    const result = index.queryRect(1, 2, 3, 3);
    const uniqueIds = new Set(result);
    expect(result.length).toBe(uniqueIds.size);
  });
});
