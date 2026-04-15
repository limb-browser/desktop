// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { ZoomAnimator, cubicBezierEaseOut } from './ZoomAnimator.mjs';
import type { ZoomAnimationProbe } from '../ports/ZoomAnimationProbe';

function createProbe() {
  const calls: { type: string; fromLevel?: number; toLevel?: number }[] = [];
  const probe: ZoomAnimationProbe = {
    animationStarted(fromLevel, toLevel) {
      calls.push({ type: 'started', fromLevel, toLevel });
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

describe('cubicBezierEaseOut', () => {
  it('returns 0 at t=0', () => {
    expect(cubicBezierEaseOut(0)).toBe(0);
  });

  it('returns 1 at t=1', () => {
    expect(cubicBezierEaseOut(1)).toBeCloseTo(1, 5);
  });

  it('is not linear at t=0.5 (ease-out progresses faster than linear)', () => {
    const midValue = cubicBezierEaseOut(0.5);
    expect(midValue).toBeGreaterThan(0.5);
  });

  it('increases monotonically', () => {
    const steps = 20;
    let prev = 0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const val = cubicBezierEaseOut(t);
      expect(val).toBeGreaterThanOrEqual(prev);
      prev = val;
    }
  });
});

describe('ZoomAnimator', () => {
  describe('zoom animates from current level to 1.0', () => {
    it('starts at the from-level and ends at the to-level after 350ms', () => {
      const animator = new ZoomAnimator();
      animator.start(
        0.5, 1.0,
        { x: 0, y: 0 }, { x: 5, y: 3 },
      );

      // At t=0, should return start values
      const frame0 = animator.update(0);
      expect(frame0).not.toBeNull();
      expect(frame0!.level).toBeCloseTo(0.5);
      expect(frame0!.focusPoint.x).toBeCloseTo(0);
      expect(frame0!.focusPoint.y).toBeCloseTo(0);
      expect(frame0!.done).toBe(false);

      // At t=350ms, should reach target
      const frameFinal = animator.update(350);
      expect(frameFinal).not.toBeNull();
      expect(frameFinal!.level).toBeCloseTo(1.0);
      expect(frameFinal!.focusPoint.x).toBeCloseTo(5);
      expect(frameFinal!.focusPoint.y).toBeCloseTo(3);
      expect(frameFinal!.done).toBe(true);
    });

    it('interpolates level at intermediate frames', () => {
      const animator = new ZoomAnimator();
      animator.start(0.5, 1.0, { x: 0, y: 0 }, { x: 10, y: 0 });

      const frame = animator.update(175); // halfway through
      expect(frame).not.toBeNull();
      expect(frame!.level).toBeGreaterThan(0.5);
      expect(frame!.level).toBeLessThan(1.0);
      expect(frame!.done).toBe(false);
    });

    it('interpolates focusPoint alongside level', () => {
      const animator = new ZoomAnimator();
      animator.start(0.0, 1.0, { x: 0, y: 0 }, { x: 10, y: 6 });

      const frame = animator.update(175);
      expect(frame).not.toBeNull();
      expect(frame!.focusPoint.x).toBeGreaterThan(0);
      expect(frame!.focusPoint.x).toBeLessThan(10);
      expect(frame!.focusPoint.y).toBeGreaterThan(0);
      expect(frame!.focusPoint.y).toBeLessThan(6);
    });
  });

  describe('animation uses ease-out timing (not linear)', () => {
    it('at t=0.5 (175ms), level is past the linear midpoint', () => {
      const animator = new ZoomAnimator();
      animator.start(0.0, 1.0, { x: 0, y: 0 }, { x: 0, y: 0 });

      const frame = animator.update(175);
      // Linear midpoint would be 0.5.
      // Ease-out progresses faster than linear, so value should be > 0.5
      expect(frame!.level).toBeGreaterThan(0.5);
    });

    it('matches the cubic-bezier easing curve', () => {
      const animator = new ZoomAnimator();
      animator.start(0.0, 1.0, { x: 0, y: 0 }, { x: 0, y: 0 });

      // At 175ms (t=0.5), level should equal cubicBezierEaseOut(0.5)
      const frame = animator.update(175);
      const expected = cubicBezierEaseOut(0.5);
      expect(frame!.level).toBeCloseTo(expected, 4);
    });
  });

  describe('clicking during animation cancels previous and starts new', () => {
    it('cancels previous animation when starting a new one', () => {
      const { probe, calls } = createProbe();
      const animator = new ZoomAnimator(probe);

      animator.start(0.0, 1.0, { x: 0, y: 0 }, { x: 5, y: 3 });
      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('started');

      // Advance partway
      animator.update(100);

      // Start a new animation (simulates a new click)
      animator.start(0.3, 1.0, { x: 2, y: 1 }, { x: 8, y: 4 });

      // Should have: started, cancelled, started
      expect(calls).toHaveLength(3);
      expect(calls[1].type).toBe('cancelled');
      expect(calls[2].type).toBe('started');
    });

    it('new animation starts from the new parameters, not the old', () => {
      const animator = new ZoomAnimator();

      animator.start(0.0, 1.0, { x: 0, y: 0 }, { x: 5, y: 3 });
      animator.update(100);

      // Start new animation
      animator.start(0.3, 1.0, { x: 2, y: 1 }, { x: 8, y: 4 });

      const frame = animator.update(0);
      expect(frame!.level).toBeCloseTo(0.3);
      expect(frame!.focusPoint.x).toBeCloseTo(2);
      expect(frame!.focusPoint.y).toBeCloseTo(1);
    });

    it('new animation completes at new target after full duration', () => {
      const animator = new ZoomAnimator();

      animator.start(0.0, 1.0, { x: 0, y: 0 }, { x: 5, y: 3 });
      animator.update(100);

      animator.start(0.3, 1.0, { x: 2, y: 1 }, { x: 8, y: 4 });
      const frame = animator.update(350);

      expect(frame!.level).toBeCloseTo(1.0);
      expect(frame!.focusPoint.x).toBeCloseTo(8);
      expect(frame!.focusPoint.y).toBeCloseTo(4);
      expect(frame!.done).toBe(true);
    });
  });

  describe('isAnimating', () => {
    it('is false before any animation starts', () => {
      const animator = new ZoomAnimator();
      expect(animator.isAnimating).toBe(false);
    });

    it('is true during animation', () => {
      const animator = new ZoomAnimator();
      animator.start(0.0, 1.0, { x: 0, y: 0 }, { x: 5, y: 3 });
      expect(animator.isAnimating).toBe(true);
    });

    it('is false after animation completes', () => {
      const animator = new ZoomAnimator();
      animator.start(0.0, 1.0, { x: 0, y: 0 }, { x: 5, y: 3 });
      animator.update(350);
      expect(animator.isAnimating).toBe(false);
    });

    it('is false after cancel', () => {
      const animator = new ZoomAnimator();
      animator.start(0.0, 1.0, { x: 0, y: 0 }, { x: 5, y: 3 });
      animator.cancel();
      expect(animator.isAnimating).toBe(false);
    });
  });

  describe('skipToEnd', () => {
    it('immediately sets level and focusPoint to final values', () => {
      const animator = new ZoomAnimator();
      animator.start(0.3, 1.0, { x: 0, y: 0 }, { x: 10, y: 6 });
      animator.update(50); // partway

      animator.skipToEnd();

      // Next update should return null (no longer animating)
      expect(animator.isAnimating).toBe(false);
      expect(animator.update(16)).toBeNull();
    });

    it('returns the final state frame', () => {
      const animator = new ZoomAnimator();
      animator.start(0.3, 1.0, { x: 0, y: 0 }, { x: 10, y: 6 });
      animator.update(50);

      const finalFrame = animator.skipToEnd();
      expect(finalFrame).not.toBeNull();
      expect(finalFrame!.level).toBeCloseTo(1.0);
      expect(finalFrame!.focusPoint.x).toBeCloseTo(10);
      expect(finalFrame!.focusPoint.y).toBeCloseTo(6);
      expect(finalFrame!.done).toBe(true);
    });

    it('fires animationCompleted probe event', () => {
      const { probe, calls } = createProbe();
      const animator = new ZoomAnimator(probe);
      animator.start(0.3, 1.0, { x: 0, y: 0 }, { x: 10, y: 6 });

      animator.skipToEnd();

      expect(calls.filter(c => c.type === 'completed')).toHaveLength(1);
    });

    it('returns null when not animating', () => {
      const animator = new ZoomAnimator();
      const result = animator.skipToEnd();
      expect(result).toBeNull();
    });
  });

  describe('update returns null when not animating', () => {
    it('returns null before start', () => {
      const animator = new ZoomAnimator();
      expect(animator.update(16)).toBeNull();
    });

    it('returns null after animation completes', () => {
      const animator = new ZoomAnimator();
      animator.start(0.0, 1.0, { x: 0, y: 0 }, { x: 5, y: 3 });
      animator.update(350);
      expect(animator.update(16)).toBeNull();
    });
  });

  describe('probe events', () => {
    it('fires animationStarted on start', () => {
      const { probe, calls } = createProbe();
      const animator = new ZoomAnimator(probe);

      animator.start(0.3, 1.0, { x: 0, y: 0 }, { x: 5, y: 3 });

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({ type: 'started', fromLevel: 0.3, toLevel: 1.0 });
    });

    it('fires animationCompleted when animation finishes', () => {
      const { probe, calls } = createProbe();
      const animator = new ZoomAnimator(probe);

      animator.start(0.0, 1.0, { x: 0, y: 0 }, { x: 5, y: 3 });
      animator.update(350);

      expect(calls).toHaveLength(2);
      expect(calls[1].type).toBe('completed');
    });

    it('fires animationCancelled on cancel', () => {
      const { probe, calls } = createProbe();
      const animator = new ZoomAnimator(probe);

      animator.start(0.0, 1.0, { x: 0, y: 0 }, { x: 5, y: 3 });
      animator.cancel();

      expect(calls).toHaveLength(2);
      expect(calls[1].type).toBe('cancelled');
    });

    it('does not fire cancelled when not animating', () => {
      const { probe, calls } = createProbe();
      const animator = new ZoomAnimator(probe);

      animator.cancel();

      expect(calls).toHaveLength(0);
    });
  });
});
