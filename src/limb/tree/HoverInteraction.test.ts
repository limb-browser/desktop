// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { HoverInteraction } from './HoverInteraction.mjs';

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

describe('HoverInteraction', () => {
  describe('hit-testing', () => {
    it('detects hover on the correct node', () => {
      const hover = new HoverInteraction();
      const rects = [
        makeRect('a', 0, 0, 100, 80),
        makeRect('b', 200, 0, 100, 80),
      ];

      hover.setMousePosition(50, 40); // inside 'a'
      const state = hover.update(rects, 0);

      expect(state.hoveredNodeId).toBe('a');
    });

    it('returns null when mouse is not over any node', () => {
      const hover = new HoverInteraction();
      const rects = [makeRect('a', 0, 0, 100, 80)];

      hover.setMousePosition(200, 200); // outside all rects
      const state = hover.update(rects, 0);

      expect(state.hoveredNodeId).toBeNull();
    });

    it('detects hover on the second node when mouse is inside it', () => {
      const hover = new HoverInteraction();
      const rects = [
        makeRect('a', 0, 0, 100, 80),
        makeRect('b', 200, 0, 100, 80),
      ];

      hover.setMousePosition(250, 40); // inside 'b'
      const state = hover.update(rects, 0);

      expect(state.hoveredNodeId).toBe('b');
    });

    it('switches hovered node when mouse moves between nodes', () => {
      const hover = new HoverInteraction();
      const rects = [
        makeRect('a', 0, 0, 100, 80),
        makeRect('b', 200, 0, 100, 80),
      ];

      hover.setMousePosition(50, 40);
      hover.update(rects, 0);

      hover.setMousePosition(250, 40);
      const state = hover.update(rects, 0);

      expect(state.hoveredNodeId).toBe('b');
    });

    it('detects hover at node boundaries', () => {
      const hover = new HoverInteraction();
      const rects = [makeRect('a', 10, 20, 100, 80)];

      // Exactly at top-left corner
      hover.setMousePosition(10, 20);
      expect(hover.update(rects, 0).hoveredNodeId).toBe('a');

      // Exactly at bottom-right corner
      hover.setMousePosition(110, 100);
      expect(hover.update(rects, 0).hoveredNodeId).toBe('a');

      // Just outside right edge
      hover.setMousePosition(111, 50);
      expect(hover.update(rects, 0).hoveredNodeId).toBeNull();
    });
  });

  describe('hover animation progress', () => {
    it('starts at zero progress', () => {
      const hover = new HoverInteraction();
      const rects = [makeRect('a', 0, 0, 100, 80)];

      hover.setMousePosition(50, 40);
      const state = hover.update(rects, 0);

      expect(state.hoverProgress.get('a') ?? 0).toBe(0);
    });

    it('increases hover progress over time', () => {
      const hover = new HoverInteraction();
      const rects = [makeRect('a', 0, 0, 100, 80)];

      hover.setMousePosition(50, 40);
      hover.update(rects, 0);

      const state = hover.update(rects, 50);

      expect(state.hoverProgress.get('a')).toBeCloseTo(0.5, 1);
    });

    it('reaches 1.0 after 100ms', () => {
      const hover = new HoverInteraction();
      const rects = [makeRect('a', 0, 0, 100, 80)];

      hover.setMousePosition(50, 40);
      hover.update(rects, 0);
      const state = hover.update(rects, 100);

      expect(state.hoverProgress.get('a')).toBe(1);
    });

    it('does not exceed 1.0', () => {
      const hover = new HoverInteraction();
      const rects = [makeRect('a', 0, 0, 100, 80)];

      hover.setMousePosition(50, 40);
      hover.update(rects, 0);
      const state = hover.update(rects, 200);

      expect(state.hoverProgress.get('a')).toBe(1);
    });

    it('decays progress when mouse leaves node', () => {
      const hover = new HoverInteraction();
      const rects = [makeRect('a', 0, 0, 100, 80)];

      hover.setMousePosition(50, 40);
      hover.update(rects, 0);
      hover.update(rects, 100); // fully hovered

      hover.setMousePosition(500, 500); // move away
      const state = hover.update(rects, 50);

      expect(state.hoverProgress.get('a')).toBeCloseTo(0.5, 1);
    });

    it('removes node from progress map when progress reaches 0', () => {
      const hover = new HoverInteraction();
      const rects = [makeRect('a', 0, 0, 100, 80)];

      hover.setMousePosition(50, 40);
      hover.update(rects, 0);
      hover.update(rects, 100); // fully hovered

      hover.setMousePosition(500, 500);
      const state = hover.update(rects, 100); // fully decayed

      expect(state.hoverProgress.has('a')).toBe(false);
    });
  });
});
