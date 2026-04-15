// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { ZoomOutAndBackAnimator, computeIntermediateZoomLevel } from './ZoomOutAndBackAnimator.mjs';
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

describe('ZoomOutAndBackAnimator', () => {
  describe('three-phase animation choreography', () => {
    it('starts in zoom-out phase at the from-level', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );

      const frame = animator.update(0);
      expect(frame).not.toBeNull();
      expect(frame!.level).toBeCloseTo(1.0);
      expect(frame!.focusPoint.x).toBeCloseTo(5);
      expect(frame!.focusPoint.y).toBeCloseTo(3);
      expect(frame!.phase).toBe('zoom-out');
      expect(frame!.done).toBe(false);
    });

    it('reaches hold level after phase 1 (200ms)', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );

      const frame = animator.update(200);
      expect(frame).not.toBeNull();
      expect(frame!.level).toBeCloseTo(0.65);
      expect(frame!.focusPoint.x).toBeCloseTo(5.5);
      expect(frame!.focusPoint.y).toBeCloseTo(3.5);
      expect(frame!.phase).toBe('hold');
    });

    it('stays at hold level during phase 2 (200ms to 350ms)', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );

      animator.update(200);
      const frame = animator.update(75); // 275ms total, mid-hold
      expect(frame).not.toBeNull();
      expect(frame!.level).toBeCloseTo(0.65);
      expect(frame!.focusPoint.x).toBeCloseTo(5.5);
      expect(frame!.focusPoint.y).toBeCloseTo(3.5);
      expect(frame!.phase).toBe('hold');
      expect(frame!.done).toBe(false);
    });

    it('transitions to zoom-in phase after hold (350ms)', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );

      // Advance past phase 1 and phase 2
      animator.update(200); // end of zoom-out
      animator.update(150); // end of hold (350ms total)
      const frame = animator.update(1); // just into zoom-in
      expect(frame).not.toBeNull();
      expect(frame!.phase).toBe('zoom-in');
      expect(frame!.done).toBe(false);
    });

    it('reaches final state after all phases (600ms total)', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );

      // Phase 1: 200ms, Phase 2: 150ms, Phase 3: 250ms = 600ms total
      const frame = animator.update(600);
      expect(frame).not.toBeNull();
      expect(frame!.level).toBeCloseTo(1.0);
      expect(frame!.focusPoint.x).toBeCloseTo(6);
      expect(frame!.focusPoint.y).toBeCloseTo(4);
      expect(frame!.done).toBe(true);
    });
  });

  describe('zoom-out uses ease-out timing', () => {
    it('at halfway through phase 1, level progresses faster than linear', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.0, 1.0,
        { x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 },
      );

      const frame = animator.update(100); // 50% of 200ms
      expect(frame).not.toBeNull();
      // Ease-out: progress > linear 0.5, so level should be below 0.5 (decreasing from 1.0 to 0.0)
      expect(frame!.level).toBeLessThan(0.5);
    });
  });

  describe('zoom-in uses ease-out timing', () => {
    it('at halfway through phase 3, level progresses faster than linear', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.0, 1.0,
        { x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 },
      );

      animator.update(200); // end phase 1
      animator.update(150); // end phase 2
      const frame = animator.update(125); // 50% of 250ms phase 3

      expect(frame).not.toBeNull();
      // Ease-out: 50% time -> >50% progress from 0.0 to 1.0
      expect(frame!.level).toBeGreaterThan(0.5);
    });
  });

  describe('user input cancels animation', () => {
    it('cancel stops the animation', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );

      animator.update(100); // mid phase 1
      animator.cancel();

      expect(animator.isAnimating).toBe(false);
    });

    it('update returns null after cancel', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );

      animator.update(100);
      animator.cancel();

      expect(animator.update(16)).toBeNull();
    });

    it('cancel fires animationCancelled probe', () => {
      const { probe, calls } = createProbe();
      const animator = new ZoomOutAndBackAnimator(probe);
      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );

      animator.update(100);
      animator.cancel();

      expect(calls.some(c => c.type === 'cancelled')).toBe(true);
    });
  });

  describe('finalState exposes jump-to target for cancellation', () => {
    it('returns the target level and focus point', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );

      const final = animator.finalState;
      expect(final.level).toBe(1.0);
      expect(final.focusPoint.x).toBe(6);
      expect(final.focusPoint.y).toBe(4);
    });
  });

  describe('isAnimating', () => {
    it('is false before start', () => {
      const animator = new ZoomOutAndBackAnimator();
      expect(animator.isAnimating).toBe(false);
    });

    it('is true during animation', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );
      expect(animator.isAnimating).toBe(true);
    });

    it('is false after animation completes', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );
      animator.update(600);
      expect(animator.isAnimating).toBe(false);
    });

    it('is false after cancel', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );
      animator.cancel();
      expect(animator.isAnimating).toBe(false);
    });
  });

  describe('update returns null when not animating', () => {
    it('returns null before start', () => {
      const animator = new ZoomOutAndBackAnimator();
      expect(animator.update(16)).toBeNull();
    });

    it('returns null after completion', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );
      animator.update(600);
      expect(animator.update(16)).toBeNull();
    });
  });

  describe('probe events', () => {
    it('fires animationStarted on start', () => {
      const { probe, calls } = createProbe();
      const animator = new ZoomOutAndBackAnimator(probe);

      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );

      expect(calls).toHaveLength(2); // started + phaseChanged('zoom-out')
      expect(calls[0]).toEqual({
        type: 'started', fromLevel: 1.0, holdLevel: 0.65, toLevel: 1.0,
      });
      expect(calls[1]).toEqual({ type: 'phaseChanged', phase: 'zoom-out' });
    });

    it('fires phaseChanged when transitioning to hold', () => {
      const { probe, calls } = createProbe();
      const animator = new ZoomOutAndBackAnimator(probe);

      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );
      animator.update(200); // end of zoom-out

      const holdChange = calls.find(c => c.type === 'phaseChanged' && c.phase === 'hold');
      expect(holdChange).toBeDefined();
    });

    it('fires phaseChanged when transitioning to zoom-in', () => {
      const { probe, calls } = createProbe();
      const animator = new ZoomOutAndBackAnimator(probe);

      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );
      animator.update(200);
      animator.update(150);
      animator.update(1);

      const zoomInChange = calls.find(c => c.type === 'phaseChanged' && c.phase === 'zoom-in');
      expect(zoomInChange).toBeDefined();
    });

    it('fires animationCompleted when animation finishes', () => {
      const { probe, calls } = createProbe();
      const animator = new ZoomOutAndBackAnimator(probe);

      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );
      animator.update(600);

      expect(calls[calls.length - 1].type).toBe('completed');
    });

    it('does not fire cancelled when not animating', () => {
      const { probe, calls } = createProbe();
      const animator = new ZoomOutAndBackAnimator(probe);

      animator.cancel();

      expect(calls).toHaveLength(0);
    });
  });

  describe('starting new animation cancels previous', () => {
    it('cancels in-progress animation before starting new one', () => {
      const { probe, calls } = createProbe();
      const animator = new ZoomOutAndBackAnimator(probe);

      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );
      animator.update(100);

      animator.start(
        0.95, 0.6, 1.0,
        { x: 2, y: 1 }, { x: 3, y: 2 }, { x: 4, y: 3 },
      );

      expect(calls.some(c => c.type === 'cancelled')).toBe(true);
      expect(animator.isAnimating).toBe(true);
    });
  });

  describe('cumulative update calls across phases', () => {
    it('correctly accumulates time across multiple small deltas', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );

      // 37 frames at 16ms each = 592ms, almost at 600ms total
      for (let i = 0; i < 37; i++) {
        const frame = animator.update(16);
        expect(frame).not.toBeNull();
      }

      // One more frame should complete it
      const finalFrame = animator.update(16);
      expect(finalFrame).not.toBeNull();
      expect(finalFrame!.done).toBe(true);
      expect(finalFrame!.level).toBeCloseTo(1.0);
      expect(finalFrame!.focusPoint.x).toBeCloseTo(6);
      expect(finalFrame!.focusPoint.y).toBeCloseTo(4);
    });
  });

  describe('final state is zoomed into new child at level 1.0', () => {
    it('ends at toLevel with toFocus when started from 0.95', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        0.95, 0.6, 1.0,
        { x: 3, y: 2 }, { x: 4, y: 3 }, { x: 5, y: 4 },
      );

      const frame = animator.update(600);
      expect(frame!.level).toBeCloseTo(1.0);
      expect(frame!.focusPoint.x).toBeCloseTo(5);
      expect(frame!.focusPoint.y).toBeCloseTo(4);
      expect(frame!.done).toBe(true);
    });

    it('finalState matches the target even during animation', () => {
      const animator = new ZoomOutAndBackAnimator();
      animator.start(
        1.0, 0.65, 1.0,
        { x: 5, y: 3 }, { x: 5.5, y: 3.5 }, { x: 6, y: 4 },
      );

      animator.update(100); // mid-animation

      const final = animator.finalState;
      expect(final.level).toBe(1.0);
      expect(final.focusPoint.x).toBe(6);
      expect(final.focusPoint.y).toBe(4);
    });
  });
});

describe('computeIntermediateZoomLevel', () => {
  const viewport = { width: 1920, height: 1080 };
  const nodeWidth = 0.8;
  const nodeHeight = 0.6;

  it('returns a level in [0.3, 0.75]', () => {
    const treeExtent = { width: 10, height: 6 };
    const level = computeIntermediateZoomLevel(
      { x: 3, y: 1 }, { x: 3.5, y: 2 },
      viewport, treeExtent, nodeWidth, nodeHeight,
    );
    expect(level).toBeGreaterThanOrEqual(0.3);
    expect(level).toBeLessThanOrEqual(0.75);
  });

  it('zooms out more for nodes that are farther apart', () => {
    const treeExtent = { width: 20, height: 10 };
    const closeLevel = computeIntermediateZoomLevel(
      { x: 3, y: 1 }, { x: 3.5, y: 2 },
      viewport, treeExtent, nodeWidth, nodeHeight,
    );
    const farLevel = computeIntermediateZoomLevel(
      { x: 3, y: 1 }, { x: 8, y: 5 },
      viewport, treeExtent, nodeWidth, nodeHeight,
    );
    expect(farLevel).toBeLessThan(closeLevel);
  });

  it('returns a level where viewport covers both nodes', () => {
    const treeExtent = { width: 10, height: 6 };
    const parent = { x: 3, y: 1 };
    const child = { x: 4, y: 2 };
    const level = computeIntermediateZoomLevel(
      parent, child, viewport, treeExtent, nodeWidth, nodeHeight,
    );

    // At this level, compute the viewport coverage and verify both nodes fit
    const maxScale = viewport.width;
    const minScaleX = viewport.width / Math.max(treeExtent.width, 1);
    const minScaleY = viewport.height / Math.max(treeExtent.height, 1);
    const minScale = Math.min(minScaleX, minScaleY);
    const scale = minScale * Math.pow(maxScale / minScale, level);
    const viewportLogicalWidth = viewport.width / scale;
    const viewportLogicalHeight = viewport.height / scale;

    const dx = Math.abs(parent.x - child.x);
    const dy = Math.abs(parent.y - child.y);

    // Both nodes should fit with padding
    expect(viewportLogicalWidth).toBeGreaterThan(dx + nodeWidth);
    expect(viewportLogicalHeight).toBeGreaterThan(dy + nodeHeight);
  });

  it('clamps to 0.3 minimum for very far apart nodes', () => {
    const treeExtent = { width: 100, height: 50 };
    const level = computeIntermediateZoomLevel(
      { x: 0, y: 0 }, { x: 80, y: 40 },
      viewport, treeExtent, nodeWidth, nodeHeight,
    );
    expect(level).toBe(0.3);
  });

  it('clamps to 0.75 maximum for very close nodes in a large tree', () => {
    // Large tree makes minScale small; very close nodes makes requiredScale large
    // The natural level > 0.75, so it gets clamped
    const largeTreeExtent = { width: 100, height: 60 };
    const level = computeIntermediateZoomLevel(
      { x: 50, y: 30 }, { x: 50.1, y: 30.1 },
      viewport, largeTreeExtent, nodeWidth, nodeHeight,
    );
    expect(level).toBe(0.75);
  });

  it('returns 0.65 fallback when minScale >= maxScale', () => {
    // Small viewport + small tree triggers minScale >= maxScale
    const smallViewport = { width: 100, height: 100 };
    const tinyExtent = { width: 0.5, height: 0.3 };
    const level = computeIntermediateZoomLevel(
      { x: 0, y: 0 }, { x: 0.1, y: 0.1 },
      smallViewport, tinyExtent, nodeWidth, nodeHeight,
    );
    expect(level).toBe(0.65);
  });
});
