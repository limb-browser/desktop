// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { LayoutAnimator } from './LayoutAnimator.mjs';
import type { LayoutAnimationProbe } from '../ports/LayoutAnimationProbe';

function createProbe() {
  const calls: { type: string; addedCount?: number; removedCount?: number; movedCount?: number }[] = [];
  const probe: LayoutAnimationProbe = {
    transitionStarted(addedCount, removedCount, movedCount) {
      calls.push({ type: 'started', addedCount, removedCount, movedCount });
    },
    transitionCompleted() {
      calls.push({ type: 'completed' });
    },
    transitionCancelled() {
      calls.push({ type: 'cancelled' });
    },
  };
  return { probe, calls };
}

function pos(x: number, y: number) {
  return { x, y };
}

describe('LayoutAnimator', () => {
  describe('positions interpolate smoothly from old to new', () => {
    it('at t=0, positions are at old values', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(2, 0)]]),
        new Map(),
      );

      const frame = animator.tick(0);
      expect(frame.positions.get('B')!.x).toBe(1);
    });

    it('at t=200ms (SHIFT_DURATION), positions are at new values', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(2, 0)]]),
        new Map(),
      );

      const frame = animator.tick(200);
      expect(frame.positions.get('B')!.x).toBeCloseTo(2);
    });

    it('at midpoint (100ms), position is at 50% (ease-in-out symmetric)', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(10, 0)]]),
        new Map(),
      );

      const frame = animator.tick(100);
      expect(frame.positions.get('B')!.x).toBeCloseTo(5);
    });

    it('uses ease-in-out: slower at edges, faster in middle', () => {
      const animator1 = new LayoutAnimator();
      animator1.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator1.beginTransition(
        new Map([['A', pos(100, 0)]]),
        new Map(),
      );

      // At 25% time (50ms), ease-in-out < 25%
      const frame25 = animator1.tick(50);
      expect(frame25.positions.get('A')!.x).toBeLessThan(25);

      const animator2 = new LayoutAnimator();
      animator2.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator2.beginTransition(
        new Map([['A', pos(100, 0)]]),
        new Map(),
      );

      // At 75% time (150ms), ease-in-out > 75%
      const frame75 = animator2.tick(150);
      expect(frame75.positions.get('A')!.x).toBeGreaterThan(75);
    });

    it('interpolates both x and y coordinates', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(10, 6)]]),
        new Map(),
      );

      const frame = animator.tick(100); // midpoint
      expect(frame.positions.get('A')!.x).toBeCloseTo(5);
      expect(frame.positions.get('A')!.y).toBeCloseTo(3);
    });
  });

  describe('new nodes fade in with correct delay', () => {
    it('new node has opacity 0 at t=0', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 0)]]),
        new Map([['B', 'A']]),
      );

      const frame = animator.tick(0);
      expect(frame.opacity.get('B')).toBe(0);
    });

    it('new node still has opacity 0 before 100ms delay expires', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 0)]]),
        new Map([['B', 'A']]),
      );

      const frame = animator.tick(50);
      expect(frame.opacity.get('B')).toBe(0);
    });

    it('new node starts fading in after 100ms delay', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 0)]]),
        new Map([['B', 'A']]),
      );

      const frame = animator.tick(150); // 100ms delay + 50ms into fade
      const opacity = frame.opacity.get('B')!;
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(1);
    });

    it('new node reaches full opacity after 100ms delay + 150ms fade', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 0)]]),
        new Map([['B', 'A']]),
      );

      const frame = animator.tick(250);
      expect(frame.opacity.get('B')).toBeCloseTo(1);
    });

    it('uses ease-out for fade-in', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 0)]]),
        new Map([['B', 'A']]),
      );

      // At delay + half of fade (100 + 75 = 175ms)
      const frame = animator.tick(175);
      const opacity = frame.opacity.get('B')!;
      // ease-out at t=0.5: 1-(1-0.5)^2 = 0.75 → faster than linear 0.5
      expect(opacity).toBeGreaterThan(0.5);
    });
  });

  describe('removed nodes fade out before siblings shift', () => {
    it('removed node has opacity 1 at t=0', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 1)], ['C', pos(2, 1)]]),
        new Map([['B', 'A'], ['C', 'A']]),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['C', pos(1, 1)]]),
        new Map([['C', 'A']]),
      );

      const frame = animator.tick(0);
      expect(frame.opacity.get('B')).toBe(1);
      expect(frame.positions.has('B')).toBe(true);
    });

    it('removed node fades out over 150ms', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 1)], ['C', pos(2, 1)]]),
        new Map([['B', 'A'], ['C', 'A']]),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['C', pos(1, 1)]]),
        new Map([['C', 'A']]),
      );

      const frameAt75 = animator.tick(75);
      const opacity = frameAt75.opacity.get('B')!;
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(1);

      const frameAt150 = animator.tick(75); // elapsed = 150
      // Node fully faded, no longer in output
      expect(frameAt150.opacity.has('B')).toBe(false);
      expect(frameAt150.positions.has('B')).toBe(false);
    });

    it('siblings do not start shifting until fade completes (150ms)', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 1)], ['C', pos(2, 1)]]),
        new Map([['B', 'A'], ['C', 'A']]),
      );
      // Remove B; C shifts from (2,1) to (1,1)
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['C', pos(1, 1)]]),
        new Map([['C', 'A']]),
      );

      // At t=100 (during fade), C should still be at old position
      const frame = animator.tick(100);
      expect(frame.positions.get('C')!.x).toBe(2);
    });

    it('siblings shift after fade completes', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 1)], ['C', pos(2, 1)]]),
        new Map([['B', 'A'], ['C', 'A']]),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['C', pos(1, 1)]]),
        new Map([['C', 'A']]),
      );

      // At t=250 (150ms fade + 100ms into shift)
      const frame = animator.tick(250);
      const cx = frame.positions.get('C')!.x;
      expect(cx).toBeLessThan(2);
      expect(cx).toBeGreaterThan(1);
    });

    it('siblings reach final position after fade + shift (350ms)', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 1)], ['C', pos(2, 1)]]),
        new Map([['B', 'A'], ['C', 'A']]),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['C', pos(1, 1)]]),
        new Map([['C', 'A']]),
      );

      const frame = animator.tick(350);
      expect(frame.positions.get('C')!.x).toBeCloseTo(1);
    });
  });

  describe('batch animations complete within 400ms', () => {
    it('mixed addition+removal batch completes within 400ms', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([
          ['A', pos(1.5, 0)],
          ['B', pos(0, 1)],
          ['C', pos(1, 1)],
          ['D', pos(2, 1)],
          ['E', pos(3, 1)],
        ]),
        new Map([['B', 'A'], ['C', 'A'], ['D', 'A'], ['E', 'A']]),
      );
      // Remove C and D, add F
      animator.beginTransition(
        new Map([
          ['A', pos(1, 0)],
          ['B', pos(0, 1)],
          ['E', pos(1, 1)],
          ['F', pos(2, 1)],
        ]),
        new Map([['B', 'A'], ['E', 'A'], ['F', 'A']]),
      );

      const frame = animator.tick(400);
      expect(frame.isAnimating).toBe(false);
    });

    it('many additions complete within 400ms', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );

      const positions = new Map([['A', pos(5, 0)]]);
      const parentMap = new Map<string, string>();
      for (let i = 0; i < 10; i++) {
        positions.set(`N${i}`, pos(i, 1));
        parentMap.set(`N${i}`, 'A');
      }
      animator.beginTransition(positions, parentMap);

      const frame = animator.tick(400);
      expect(frame.isAnimating).toBe(false);
    });

    it('many removals complete within 400ms', () => {
      const animator = new LayoutAnimator();
      const initialPositions = new Map<string, { x: number; y: number }>([['A', pos(5, 0)]]);
      const initialParentMap = new Map<string, string>();
      for (let i = 0; i < 10; i++) {
        initialPositions.set(`N${i}`, pos(i, 1));
        initialParentMap.set(`N${i}`, 'A');
      }
      animator.beginTransition(initialPositions, initialParentMap);

      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );

      const frame = animator.tick(400);
      expect(frame.isAnimating).toBe(false);
    });
  });

  describe('edge animations', () => {
    it('new edge has progress 0 at t=0', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(0, 1)]]),
        new Map([['B', 'A']]),
      );

      const frame = animator.tick(0);
      expect(frame.edgeProgress.get('B')).toBe(0);
    });

    it('new edge fully drawn at 200ms', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(0, 1)]]),
        new Map([['B', 'A']]),
      );

      const frame = animator.tick(200);
      expect(frame.edgeProgress.get('B')).toBeCloseTo(1);
    });

    it('new edge uses ease-out', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(0, 1)]]),
        new Map([['B', 'A']]),
      );

      // At t=100 (50% through 200ms), ease-out > 0.5
      const frame = animator.tick(100);
      expect(frame.edgeProgress.get('B')!).toBeGreaterThan(0.5);
    });

    it('removed edge has opacity 1 at t=0', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(0, 1)]]),
        new Map([['B', 'A']]),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );

      const frame = animator.tick(0);
      expect(frame.edgeOpacity.get('B')).toBe(1);
    });

    it('removed edge fades out over 150ms', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(0, 1)]]),
        new Map([['B', 'A']]),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );

      const frame0 = animator.tick(0);
      expect(frame0.edgeOpacity.get('B')).toBe(1);

      const frame150 = animator.tick(150); // elapsed = 150
      expect(frame150.edgeOpacity.has('B')).toBe(false);
    });

    it('removed edge included in parentMap during fade', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(0, 1)]]),
        new Map([['B', 'A']]),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );

      const frame = animator.tick(50);
      // Removed edge should be in parentMap so renderer can compute edge path
      expect(frame.parentMap.get('B')).toBe('A');
    });
  });

  describe('isAnimating', () => {
    it('is false before any transition', () => {
      const animator = new LayoutAnimator();
      expect(animator.isAnimating).toBe(false);
    });

    it('is false after first layout (no animation)', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      expect(animator.isAnimating).toBe(false);
    });

    it('is true during animation', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(1, 0)]]),
        new Map(),
      );
      expect(animator.isAnimating).toBe(true);
    });

    it('is false after animation completes', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(1, 0)]]),
        new Map(),
      );
      animator.tick(200);
      expect(animator.isAnimating).toBe(false);
    });
  });

  describe('probe events', () => {
    it('fires transitionStarted on layout change', () => {
      const { probe, calls } = createProbe();
      const animator = new LayoutAnimator(probe);
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 0)]]),
        new Map([['B', 'A']]),
      );

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({
        type: 'started',
        addedCount: 1,
        removedCount: 0,
        movedCount: 0,
      });
    });

    it('fires transitionCompleted when animation finishes', () => {
      const { probe, calls } = createProbe();
      const animator = new LayoutAnimator(probe);
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(1, 0)]]),
        new Map(),
      );
      animator.tick(200);

      expect(calls).toHaveLength(2);
      expect(calls[1].type).toBe('completed');
    });

    it('fires transitionCancelled when new transition interrupts active one', () => {
      const { probe, calls } = createProbe();
      const animator = new LayoutAnimator(probe);
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(1, 0)]]),
        new Map(),
      );
      // started
      animator.tick(50);
      animator.beginTransition(
        new Map([['A', pos(2, 0)]]),
        new Map(),
      );

      // started, cancelled, started
      expect(calls.filter(c => c.type === 'cancelled')).toHaveLength(1);
      expect(calls.filter(c => c.type === 'started')).toHaveLength(2);
    });

    it('does not fire on first layout (no animation)', () => {
      const { probe, calls } = createProbe();
      const animator = new LayoutAnimator(probe);
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );

      expect(calls).toHaveLength(0);
    });
  });

  describe('skipToEnd', () => {
    it('immediately applies final positions and stops animating', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(5, 0)]]),
        new Map(),
      );

      animator.tick(50); // partway
      expect(animator.isAnimating).toBe(true);

      animator.skipToEnd();
      expect(animator.isAnimating).toBe(false);

      const frame = animator.tick(0);
      expect(frame.positions.get('B')!.x).toBeCloseTo(5);
      expect(frame.isAnimating).toBe(false);
    });

    it('added nodes have full opacity after skipToEnd', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 0)]]),
        new Map([['B', 'A']]),
      );

      animator.tick(0); // opacity 0 for B
      animator.skipToEnd();

      const frame = animator.tick(0);
      // B should not be in opacity map (fully opaque = default)
      expect(frame.opacity.has('B')).toBe(false);
    });

    it('removed nodes are gone after skipToEnd', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 0)]]),
        new Map([['B', 'A']]),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );

      animator.tick(0); // B fading out
      animator.skipToEnd();

      const frame = animator.tick(0);
      expect(frame.positions.has('B')).toBe(false);
    });

    it('fires transitionCompleted probe event', () => {
      const { probe, calls } = createProbe();
      const animator = new LayoutAnimator(probe);
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(1, 0)]]),
        new Map(),
      );

      animator.skipToEnd();

      expect(calls.filter(c => c.type === 'completed')).toHaveLength(1);
    });

    it('is a no-op when not animating', () => {
      const { probe, calls } = createProbe();
      const animator = new LayoutAnimator(probe);
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );

      animator.skipToEnd(); // not animating, should not fire events
      expect(calls).toHaveLength(0);
    });
  });

  describe('no animation when positions unchanged', () => {
    it('does not animate if positions are the same', () => {
      const { probe, calls } = createProbe();
      const animator = new LayoutAnimator(probe);
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );
      animator.beginTransition(
        new Map([['A', pos(0, 0)]]),
        new Map(),
      );

      expect(animator.isAnimating).toBe(false);
      expect(calls).toHaveLength(0);
    });
  });

  describe('tick returns stable positions when not animating', () => {
    it('returns current positions', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(3, 5)]]),
        new Map(),
      );

      const frame = animator.tick(0);
      expect(frame.positions.get('A')).toEqual(pos(3, 5));
      expect(frame.isAnimating).toBe(false);
    });
  });

  describe('mixed transitions have correct fade-in delay', () => {
    it('fade-in delay accounts for removal shift delay', () => {
      const animator = new LayoutAnimator();
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['B', pos(1, 1)]]),
        new Map([['B', 'A']]),
      );
      // Remove B, add C: mixed transition
      animator.beginTransition(
        new Map([['A', pos(0, 0)], ['C', pos(1, 1)]]),
        new Map([['C', 'A']]),
      );

      // shiftDelay=150, fadeInDelay=150+100=250
      // At t=200 (before fadeInDelay), C still has opacity 0
      const frame200 = animator.tick(200);
      expect(frame200.opacity.get('C')).toBe(0);

      // At t=300 (50ms into fade), C is partially visible
      const frame300 = animator.tick(100); // elapsed=300
      const opacity = frame300.opacity.get('C')!;
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(1);
    });
  });
});
