// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { NewChildZoomHandler } from './NewChildZoomHandler.mjs';
import { ZoomOutAndBackAnimator } from './ZoomOutAndBackAnimator.mjs';
import type { ZoomOutAndBackProbe } from '../ports/ZoomOutAndBackProbe';

function createProbe() {
  const calls: { type: string; [key: string]: unknown }[] = [];
  const probe: ZoomOutAndBackProbe = {
    animationStarted(fromLevel, holdLevel, toLevel) {
      calls.push({ type: 'started', fromLevel, holdLevel, toLevel });
    },
    phaseChanged(phase) {
      calls.push({ type: 'phaseChanged', phase });
    },
    animationCompleted() {
      calls.push({ type: 'completed' });
    },
    animationCancelled() {
      calls.push({ type: 'cancelled' });
    },
  };
  return { probe, calls };
}

function createContext(overrides: Partial<Parameters<NewChildZoomHandler['handle']>[0]> = {}) {
  return {
    zoomLevel: 1.0,
    parentPos: { x: 3, y: 1 } as { x: number; y: number } | undefined,
    childPos: { x: 3.5, y: 2 } as { x: number; y: number } | undefined,
    viewportSize: { width: 1920, height: 1080 },
    treeExtent: { width: 10, height: 6 },
    currentFocus: { x: 3, y: 1 },
    nodeWidth: 0.8,
    nodeHeight: 0.6,
    ...overrides,
  };
}

describe('NewChildZoomHandler', () => {
  let animator: ZoomOutAndBackAnimator;
  let handler: NewChildZoomHandler;
  let probe: ZoomOutAndBackProbe;
  let calls: { type: string; [key: string]: unknown }[];

  beforeEach(() => {
    ({ probe, calls } = createProbe());
    animator = new ZoomOutAndBackAnimator(probe);
    handler = new NewChildZoomHandler(animator);
  });

  describe('animation triggers when zoom >= 0.9', () => {
    it('returns animated at zoom level 1.0', () => {
      const result = handler.handle(createContext({ zoomLevel: 1.0 }));
      expect(result).toBe('animated');
    });

    it('starts the animator when zoom >= 0.9', () => {
      handler.handle(createContext({ zoomLevel: 1.0 }));
      expect(animator.isAnimating).toBe(true);
    });

    it('returns animated at the exact threshold (0.9)', () => {
      const result = handler.handle(createContext({ zoomLevel: 0.9 }));
      expect(result).toBe('animated');
    });

    it('starts the animator at the exact threshold (0.9)', () => {
      handler.handle(createContext({ zoomLevel: 0.9 }));
      expect(animator.isAnimating).toBe(true);
    });

    it('fires animationStarted probe on the animator', () => {
      handler.handle(createContext({ zoomLevel: 0.95 }));
      expect(calls[0].type).toBe('started');
    });
  });

  describe('animation does not trigger when zoom < 0.9', () => {
    it('returns centered at zoom level 0.5', () => {
      const result = handler.handle(createContext({ zoomLevel: 0.5 }));
      expect(result).toBe('centered');
    });

    it('does not start the animator when zoom < 0.9', () => {
      handler.handle(createContext({ zoomLevel: 0.5 }));
      expect(animator.isAnimating).toBe(false);
    });

    it('returns centered just below threshold (0.89)', () => {
      const result = handler.handle(createContext({ zoomLevel: 0.89 }));
      expect(result).toBe('centered');
    });

    it('does not start the animator just below threshold (0.89)', () => {
      handler.handle(createContext({ zoomLevel: 0.89 }));
      expect(animator.isAnimating).toBe(false);
    });

    it('returns centered at zoom level 0.0', () => {
      const result = handler.handle(createContext({ zoomLevel: 0.0 }));
      expect(result).toBe('centered');
    });
  });

  describe('animation zooms out far enough to show both parent and child', () => {
    it('hold level is lower than from level', () => {
      handler.handle(createContext({ zoomLevel: 1.0 }));
      // The animator was started; check the hold level via probe
      const startEvent = calls.find(c => c.type === 'started');
      expect(startEvent).toBeDefined();
      expect(startEvent!.holdLevel as number).toBeLessThan(1.0);
    });

    it('hold level allows viewport to cover both nodes', () => {
      const ctx = createContext({
        zoomLevel: 1.0,
        parentPos: { x: 3, y: 1 },
        childPos: { x: 4, y: 2 },
      });
      handler.handle(ctx);

      // Verify via computeIntermediateZoomLevel bounds (0.3 to 0.75)
      const startEvent = calls.find(c => c.type === 'started');
      expect(startEvent!.holdLevel as number).toBeGreaterThanOrEqual(0.3);
      expect(startEvent!.holdLevel as number).toBeLessThanOrEqual(0.75);
    });

    it('zooms out more for nodes that are farther apart', () => {
      const closeCtx = createContext({
        zoomLevel: 1.0,
        parentPos: { x: 3, y: 1 },
        childPos: { x: 3.5, y: 2 },
        treeExtent: { width: 20, height: 10 },
      });
      handler.handle(closeCtx);
      const closeStart = calls.find(c => c.type === 'started');
      const closeHold = closeStart!.holdLevel as number;

      // Reset for second call
      ({ probe, calls } = createProbe());
      animator = new ZoomOutAndBackAnimator(probe);
      handler = new NewChildZoomHandler(animator);

      const farCtx = createContext({
        zoomLevel: 1.0,
        parentPos: { x: 3, y: 1 },
        childPos: { x: 8, y: 5 },
        treeExtent: { width: 20, height: 10 },
      });
      handler.handle(farCtx);
      const farStart = calls.find(c => c.type === 'started');
      const farHold = farStart!.holdLevel as number;

      expect(farHold).toBeLessThan(closeHold);
    });
  });

  describe('final state is zoomed into new child at level 1.0', () => {
    it('animator targets level 1.0', () => {
      handler.handle(createContext({ zoomLevel: 0.95 }));
      const startEvent = calls.find(c => c.type === 'started');
      expect(startEvent!.toLevel).toBe(1.0);
    });

    it('animator final state focus matches child position', () => {
      const childPos = { x: 6, y: 4 };
      handler.handle(createContext({ zoomLevel: 1.0, childPos }));
      const final = animator.finalState;
      expect(final.level).toBe(1.0);
      expect(final.focusPoint.x).toBe(childPos.x);
      expect(final.focusPoint.y).toBe(childPos.y);
    });
  });

  describe('missing positions', () => {
    it('returns skipped when parent position is missing', () => {
      const result = handler.handle(createContext({ parentPos: undefined }));
      expect(result).toBe('skipped');
    });

    it('returns skipped when child position is missing', () => {
      const result = handler.handle(createContext({ childPos: undefined }));
      expect(result).toBe('skipped');
    });

    it('does not start animator when positions are missing', () => {
      handler.handle(createContext({ parentPos: undefined }));
      expect(animator.isAnimating).toBe(false);
    });
  });
});
