// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { SpatialIndex } from './SpatialIndex.mjs';

describe('SpatialIndex', () => {
  let index: SpatialIndex;

  beforeEach(() => {
    index = new SpatialIndex(1.0);
  });

  it('returns nodes within the queried region', () => {
    index.rebuild(new Map([
      ['a', { x: 0.5, y: 0.5 }],
      ['b', { x: 1.5, y: 0.5 }],
      ['c', { x: 5.0, y: 5.0 }],
    ]));

    const result = index.queryRegion(0, 0, 2, 1);

    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).not.toContain('c');
  });

  it('returns empty array for region with no nodes', () => {
    index.rebuild(new Map([['a', { x: 0, y: 0 }]]));

    const result = index.queryRegion(10, 10, 20, 20);

    expect(result).toEqual([]);
  });

  it('returns all nodes when region covers entire tree', () => {
    index.rebuild(new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 3, y: 2 }],
      ['c', { x: -1, y: -1 }],
    ]));

    const result = index.queryRegion(-10, -10, 10, 10);

    expect(result.sort()).toEqual(['a', 'b', 'c']);
  });

  it('includes nodes at region boundaries', () => {
    index.rebuild(new Map([['edge', { x: 5.0, y: 3.0 }]]));

    const result = index.queryRegion(5.0, 3.0, 10.0, 10.0);

    expect(result).toContain('edge');
  });

  it('handles negative coordinates', () => {
    index.rebuild(new Map([['neg', { x: -3, y: -2 }]]));

    const result = index.queryRegion(-5, -5, 0, 0);

    expect(result).toContain('neg');
  });

  it('rebuild replaces previous data', () => {
    index.rebuild(new Map([['old', { x: 0, y: 0 }]]));
    index.rebuild(new Map([['new', { x: 0, y: 0 }]]));

    const result = index.queryRegion(-1, -1, 1, 1);

    expect(result).toEqual(['new']);
  });
});
