// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { NodeLabelComputer } from './NodeLabelComputer.mjs';

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

// Fake text measurer: each character is 8px wide, regardless of fontSize
function fakeMeasurer(text: string, _fontSize: number): number {
  return text.length * 8;
}

describe('NodeLabelComputer', () => {
  describe('label visibility threshold', () => {
    it('shows labels when node width exceeds 60px', () => {
      const computer = new NodeLabelComputer();
      const rects = [makeRect('n1', 100, 100, 61, 40)];
      const titles = new Map([['n1', 'Test Page']]);

      const labels = computer.computeLabels(rects, titles, fakeMeasurer);

      expect(labels).toHaveLength(1);
      expect(labels[0].nodeId).toBe('n1');
    });

    it('hides labels when node width is exactly 60px', () => {
      const computer = new NodeLabelComputer();
      const rects = [makeRect('n1', 100, 100, 60, 40)];
      const titles = new Map([['n1', 'Test Page']]);

      const labels = computer.computeLabels(rects, titles, fakeMeasurer);

      expect(labels).toHaveLength(0);
    });

    it('hides labels when node width is below 60px', () => {
      const computer = new NodeLabelComputer();
      const rects = [makeRect('n1', 100, 100, 50, 40)];
      const titles = new Map([['n1', 'Test Page']]);

      const labels = computer.computeLabels(rects, titles, fakeMeasurer);

      expect(labels).toHaveLength(0);
    });
  });

  describe('text truncation', () => {
    it('returns full text when it fits within node width', () => {
      const computer = new NodeLabelComputer();
      // "Hi" = 2 chars * 8px = 16px, node width = 100px -- fits
      const rects = [makeRect('n1', 0, 0, 100, 60)];
      const titles = new Map([['n1', 'Hi']]);

      const labels = computer.computeLabels(rects, titles, fakeMeasurer);

      expect(labels[0].text).toBe('Hi');
    });

    it('truncates text with ellipsis when it would overflow', () => {
      const computer = new NodeLabelComputer();
      // "A Very Long Page Title" = 22 chars * 8px = 176px, node width = 80px
      const rects = [makeRect('n1', 0, 0, 80, 60)];
      const titles = new Map([['n1', 'A Very Long Page Title']]);

      const labels = computer.computeLabels(rects, titles, fakeMeasurer);

      expect(labels[0].text).toContain('\u2026');
      expect(labels[0].text).not.toBe('A Very Long Page Title');
      // Truncated text should fit within node width
      expect(fakeMeasurer(labels[0].text, labels[0].fontSize)).toBeLessThanOrEqual(
        80,
      );
    });

    it('does not add ellipsis when text fits exactly', () => {
      const computer = new NodeLabelComputer();
      // "1234567890" = 10 chars * 8px = 80px, node width = 80px -- exact fit
      const rects = [makeRect('n1', 0, 0, 80, 60)];
      const titles = new Map([['n1', '1234567890']]);

      const labels = computer.computeLabels(rects, titles, fakeMeasurer);

      expect(labels[0].text).toBe('1234567890');
    });
  });

  describe('label positioning', () => {
    it('positions label below the node frame', () => {
      const computer = new NodeLabelComputer();
      const rects = [makeRect('n1', 100, 200, 80, 60)];
      const titles = new Map([['n1', 'Test']]);

      const labels = computer.computeLabels(rects, titles, fakeMeasurer);

      // Label y should be below node bottom (200 + 60 = 260)
      expect(labels[0].y).toBeGreaterThan(260);
    });

    it('centers label horizontally on the node', () => {
      const computer = new NodeLabelComputer();
      const rects = [makeRect('n1', 100, 200, 80, 60)];
      const titles = new Map([['n1', 'Test']]);

      const labels = computer.computeLabels(rects, titles, fakeMeasurer);

      // Label x should be at horizontal center of node: 100 + 80/2 = 140
      expect(labels[0].x).toBe(140);
    });
  });

  describe('font scaling', () => {
    it('produces a larger font for wider nodes', () => {
      const computer = new NodeLabelComputer();
      const smallRect = [makeRect('small', 0, 0, 70, 40)];
      const largeRect = [makeRect('large', 0, 0, 200, 120)];
      const titles = new Map([
        ['small', 'A'],
        ['large', 'A'],
      ]);

      const smallLabels = computer.computeLabels(smallRect, titles, fakeMeasurer);
      const largeLabels = computer.computeLabels(largeRect, titles, fakeMeasurer);

      expect(largeLabels[0].fontSize).toBeGreaterThan(smallLabels[0].fontSize);
    });
  });

  describe('default opacity', () => {
    it('returns 0.7 opacity for labels', () => {
      const computer = new NodeLabelComputer();
      const rects = [makeRect('n1', 0, 0, 100, 60)];
      const titles = new Map([['n1', 'Test']]);

      const labels = computer.computeLabels(rects, titles, fakeMeasurer);

      expect(labels[0].opacity).toBe(0.7);
    });
  });

  describe('edge cases', () => {
    it('omits label for nodes not in the titles map', () => {
      const computer = new NodeLabelComputer();
      const rects = [makeRect('n1', 0, 0, 100, 60)];
      const titles = new Map<string, string>();

      const labels = computer.computeLabels(rects, titles, fakeMeasurer);

      expect(labels).toHaveLength(0);
    });

    it('omits label for nodes with empty title', () => {
      const computer = new NodeLabelComputer();
      const rects = [makeRect('n1', 0, 0, 100, 60)];
      const titles = new Map([['n1', '']]);

      const labels = computer.computeLabels(rects, titles, fakeMeasurer);

      expect(labels).toHaveLength(0);
    });
  });
});
