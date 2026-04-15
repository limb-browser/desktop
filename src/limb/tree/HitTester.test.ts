// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { hitTestNodes } from './HitTester.mjs';

interface NodeRect {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function makeRect(
  nodeId: string,
  x: number,
  y: number,
  width: number,
  height: number,
): NodeRect {
  return { nodeId, x, y, width, height };
}

describe('HitTester', () => {
  describe('hitTestNodes', () => {
    it('returns the correct node ID when click is inside a node', () => {
      const rects = [
        makeRect('a', 0, 0, 100, 80),
        makeRect('b', 200, 0, 100, 80),
      ];

      expect(hitTestNodes(50, 40, rects)).toBe('a');
    });

    it('returns null when click is outside all nodes', () => {
      const rects = [
        makeRect('a', 0, 0, 100, 80),
        makeRect('b', 200, 0, 100, 80),
      ];

      expect(hitTestNodes(150, 40, rects)).toBeNull();
    });

    it('returns the second node when click is inside it', () => {
      const rects = [
        makeRect('a', 0, 0, 100, 80),
        makeRect('b', 200, 0, 100, 80),
      ];

      expect(hitTestNodes(250, 40, rects)).toBe('b');
    });

    it('returns the first overlapping node when nodes overlap', () => {
      const rects = [
        makeRect('a', 0, 0, 200, 80),
        makeRect('b', 100, 0, 200, 80),
      ];

      // (150, 40) is inside both; first in array wins
      expect(hitTestNodes(150, 40, rects)).toBe('a');
    });

    it('detects clicks at exact node boundaries', () => {
      const rects = [makeRect('a', 10, 20, 100, 80)];

      // Top-left corner
      expect(hitTestNodes(10, 20, rects)).toBe('a');
      // Bottom-right corner
      expect(hitTestNodes(110, 100, rects)).toBe('a');
    });

    it('returns null just outside node boundary', () => {
      const rects = [makeRect('a', 10, 20, 100, 80)];

      expect(hitTestNodes(111, 50, rects)).toBeNull();
      expect(hitTestNodes(9, 50, rects)).toBeNull();
      expect(hitTestNodes(50, 19, rects)).toBeNull();
      expect(hitTestNodes(50, 101, rects)).toBeNull();
    });

    it('returns null for empty rects array', () => {
      expect(hitTestNodes(50, 40, [])).toBeNull();
    });
  });
});
