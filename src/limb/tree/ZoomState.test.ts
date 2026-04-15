// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { ZoomState } from './ZoomState';
import type { ZoomProbe } from '../ports/ZoomProbe';

const viewport = { width: 1000, height: 800 };
const treeExtent = { width: 10, height: 5 };

function createZoomState(
  overrides?: Partial<{
    viewport: { width: number; height: number };
    treeExtent: { width: number; height: number };
    probe: ZoomProbe;
  }>,
): ZoomState {
  return new ZoomState(
    overrides?.viewport ?? viewport,
    overrides?.treeExtent ?? treeExtent,
    overrides?.probe,
  );
}

describe('ZoomState', () => {
  describe('level clamping', () => {
    it('starts at level 0', () => {
      const z = createZoomState();
      expect(z.level).toBe(0);
    });

    it('clamps level above 1.0 to 1.0', () => {
      const z = createZoomState();
      z.setLevel(1.5);
      expect(z.level).toBe(1.0);
    });

    it('clamps level below 0.0 to 0.0', () => {
      const z = createZoomState();
      z.setLevel(-0.5);
      expect(z.level).toBe(0.0);
    });

    it('preserves level within valid range', () => {
      const z = createZoomState();
      z.setLevel(0.5);
      expect(z.level).toBe(0.5);
    });

    it('clamps exactly at boundaries', () => {
      const z = createZoomState();
      z.setLevel(0.0);
      expect(z.level).toBe(0.0);
      z.setLevel(1.0);
      expect(z.level).toBe(1.0);
    });
  });

  describe('zoomScale', () => {
    it('at level=1.0, zoomScale equals viewport width', () => {
      const z = createZoomState();
      z.setLevel(1.0);
      // 1 logical unit = full viewport width at max zoom
      expect(z.zoomScale).toBe(1000);
    });

    it('at level=0.0, entire tree fits in viewport', () => {
      const z = createZoomState();
      z.setLevel(0.0);
      // minScale = min(1000/10, 800/5) = min(100, 160) = 100
      expect(z.zoomScale).toBe(100);
    });

    it('uses smaller dimension ratio to ensure fit at level=0', () => {
      const z = createZoomState({
        viewport: { width: 1000, height: 200 },
        treeExtent: { width: 5, height: 10 },
      });
      z.setLevel(0.0);
      // minScale = min(1000/5, 200/10) = min(200, 20) = 20
      expect(z.zoomScale).toBe(20);
    });

    it('intermediate levels use exponential interpolation', () => {
      const z = createZoomState();
      z.setLevel(0.5);
      // minScale=100, maxScale=1000, ratio=10
      // zoomScale = 100 * 10^0.5 = 100 * sqrt(10)
      expect(z.zoomScale).toBeCloseTo(100 * Math.sqrt(10));
    });

    it('handles single-node tree where minScale equals maxScale', () => {
      // Square viewport so min(w/1, h/1) = maxScale = viewport width
      const z = createZoomState({
        viewport: { width: 1000, height: 1000 },
        treeExtent: { width: 1, height: 1 },
      });
      z.setLevel(0.0);
      const scaleAtZero = z.zoomScale;
      z.setLevel(1.0);
      const scaleAtOne = z.zoomScale;
      // Both should be viewport width since min >= max
      expect(scaleAtZero).toBe(1000);
      expect(scaleAtOne).toBe(1000);
    });

    it('increases monotonically with level', () => {
      const z = createZoomState();
      const scales: number[] = [];
      for (let l = 0; l <= 1.0; l += 0.1) {
        z.setLevel(l);
        scales.push(z.zoomScale);
      }
      for (let i = 1; i < scales.length; i++) {
        expect(scales[i]).toBeGreaterThanOrEqual(scales[i - 1]);
      }
    });
  });

  describe('logicalToScreen', () => {
    it('maps focusPoint to viewport center', () => {
      const z = createZoomState();
      z.setLevel(0.5);
      z.focusPoint = { x: 3, y: 2 };
      const screen = z.logicalToScreen(3, 2);
      expect(screen.x).toBe(500);
      expect(screen.y).toBe(400);
    });

    it('applies zoomScale to logical distances', () => {
      const z = createZoomState();
      z.setLevel(1.0);
      z.focusPoint = { x: 0, y: 0 };
      // At level=1.0, zoomScale=1000. Point at (1, 0) should be 1000px right of center.
      const screen = z.logicalToScreen(1, 0);
      expect(screen.x).toBe(500 + 1000);
      expect(screen.y).toBe(400);
    });

    it('positions points left of focusPoint to the left of center', () => {
      const z = createZoomState();
      z.setLevel(0.5);
      z.focusPoint = { x: 5, y: 3 };
      const screen = z.logicalToScreen(4, 3);
      expect(screen.x).toBeLessThan(500);
    });
  });

  describe('screenToLogical', () => {
    it('maps viewport center to focusPoint', () => {
      const z = createZoomState();
      z.setLevel(0.5);
      z.focusPoint = { x: 5, y: 3 };
      const logical = z.screenToLogical(500, 400);
      expect(logical.x).toBeCloseTo(5);
      expect(logical.y).toBeCloseTo(3);
    });

    it('round-trips with logicalToScreen', () => {
      const z = createZoomState();
      z.setLevel(0.7);
      z.focusPoint = { x: 5, y: 3 };
      const original = { x: 7, y: 1 };
      const screen = z.logicalToScreen(original.x, original.y);
      const back = z.screenToLogical(screen.x, screen.y);
      expect(back.x).toBeCloseTo(original.x);
      expect(back.y).toBeCloseTo(original.y);
    });

    it('round-trips at different zoom levels', () => {
      const z = createZoomState();
      z.focusPoint = { x: 2, y: 4 };
      for (const level of [0.0, 0.25, 0.5, 0.75, 1.0]) {
        z.setLevel(level);
        const point = { x: 8, y: 2 };
        const screen = z.logicalToScreen(point.x, point.y);
        const back = z.screenToLogical(screen.x, screen.y);
        expect(back.x).toBeCloseTo(point.x);
        expect(back.y).toBeCloseTo(point.y);
      }
    });
  });

  describe('cursor-anchored zoom', () => {
    it('keeps the point under the cursor fixed on screen after zoom', () => {
      const z = createZoomState();
      z.setLevel(0.5);
      z.focusPoint = { x: 5, y: 3 };

      const cursor = { x: 700, y: 300 };
      const logicalBefore = z.screenToLogical(cursor.x, cursor.y);

      z.zoomAtCursor(0.1, cursor.x, cursor.y);

      const screenAfter = z.logicalToScreen(logicalBefore.x, logicalBefore.y);
      expect(screenAfter.x).toBeCloseTo(cursor.x);
      expect(screenAfter.y).toBeCloseTo(cursor.y);
    });

    it('works when cursor is at viewport center', () => {
      const z = createZoomState();
      z.setLevel(0.5);
      z.focusPoint = { x: 5, y: 3 };

      const cursor = { x: 500, y: 400 };
      const logicalBefore = z.screenToLogical(cursor.x, cursor.y);

      z.zoomAtCursor(0.2, cursor.x, cursor.y);

      const screenAfter = z.logicalToScreen(logicalBefore.x, logicalBefore.y);
      expect(screenAfter.x).toBeCloseTo(cursor.x);
      expect(screenAfter.y).toBeCloseTo(cursor.y);
    });

    it('works when cursor is at viewport edge', () => {
      const z = createZoomState();
      z.setLevel(0.3);
      z.focusPoint = { x: 2, y: 1 };

      const cursor = { x: 50, y: 750 };
      const logicalBefore = z.screenToLogical(cursor.x, cursor.y);

      z.zoomAtCursor(0.15, cursor.x, cursor.y);

      const screenAfter = z.logicalToScreen(logicalBefore.x, logicalBefore.y);
      expect(screenAfter.x).toBeCloseTo(cursor.x);
      expect(screenAfter.y).toBeCloseTo(cursor.y);
    });

    it('works when zooming out', () => {
      const z = createZoomState();
      z.setLevel(0.8);
      z.focusPoint = { x: 5, y: 3 };

      const cursor = { x: 300, y: 600 };
      const logicalBefore = z.screenToLogical(cursor.x, cursor.y);

      z.zoomAtCursor(-0.2, cursor.x, cursor.y);

      const screenAfter = z.logicalToScreen(logicalBefore.x, logicalBefore.y);
      expect(screenAfter.x).toBeCloseTo(cursor.x);
      expect(screenAfter.y).toBeCloseTo(cursor.y);
    });

    it('clamps level when zooming past 1.0', () => {
      const z = createZoomState();
      z.setLevel(0.95);

      const cursor = { x: 700, y: 300 };
      const logicalBefore = z.screenToLogical(cursor.x, cursor.y);

      z.zoomAtCursor(0.2, cursor.x, cursor.y);

      expect(z.level).toBe(1.0);
      const screenAfter = z.logicalToScreen(logicalBefore.x, logicalBefore.y);
      expect(screenAfter.x).toBeCloseTo(cursor.x);
      expect(screenAfter.y).toBeCloseTo(cursor.y);
    });

    it('clamps level when zooming past 0.0', () => {
      const z = createZoomState();
      z.setLevel(0.05);

      const cursor = { x: 400, y: 500 };
      const logicalBefore = z.screenToLogical(cursor.x, cursor.y);

      z.zoomAtCursor(-0.3, cursor.x, cursor.y);

      expect(z.level).toBe(0.0);
      const screenAfter = z.logicalToScreen(logicalBefore.x, logicalBefore.y);
      expect(screenAfter.x).toBeCloseTo(cursor.x);
      expect(screenAfter.y).toBeCloseTo(cursor.y);
    });
  });

  describe('probe', () => {
    it('fires zoomChanged on setLevel', () => {
      const calls: { level: number; zoomScale: number }[] = [];
      const probe: ZoomProbe = {
        zoomChanged(level, zoomScale) {
          calls.push({ level, zoomScale });
        },
      };
      const z = createZoomState({ probe });

      z.setLevel(0.5);

      expect(calls).toHaveLength(1);
      expect(calls[0].level).toBe(0.5);
      expect(calls[0].zoomScale).toBeCloseTo(z.zoomScale);
    });

    it('fires zoomChanged on zoomAtCursor', () => {
      const calls: { level: number; zoomScale: number }[] = [];
      const probe: ZoomProbe = {
        zoomChanged(level, zoomScale) {
          calls.push({ level, zoomScale });
        },
      };
      const z = createZoomState({ probe });
      z.setLevel(0.5);
      calls.length = 0;

      z.zoomAtCursor(0.1, 500, 400);

      expect(calls).toHaveLength(1);
      expect(calls[0].level).toBe(0.6);
    });

    it('reports correct zoomScale in probe event', () => {
      const calls: { level: number; zoomScale: number }[] = [];
      const probe: ZoomProbe = {
        zoomChanged(level, zoomScale) {
          calls.push({ level, zoomScale });
        },
      };
      const z = createZoomState({ probe });

      z.setLevel(1.0);

      expect(calls[0].zoomScale).toBe(1000);
    });
  });
});
