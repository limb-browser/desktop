// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { RevealAnimator } from './RevealAnimator.mjs';
import type { RevealAnimationProbe } from '../ports/RevealAnimationProbe';

/**
 * Build a simple tree for testing:
 *
 *        root
 *       / | \
 *      a  b  c
 *        /|
 *       d  e
 *
 * parentMap: childId -> parentId
 */
function makeTestTree() {
  const parentMap = new Map<string, string>([
    ['a', 'root'],
    ['b', 'root'],
    ['c', 'root'],
    ['d', 'b'],
    ['e', 'b'],
  ]);
  return parentMap;
}

function makeProbe(): RevealAnimationProbe & { events: Array<{ type: string, nodeId: string, distance?: number }> } {
  const events: Array<{ type: string, nodeId: string, distance?: number }> = [];
  return {
    events,
    revealStarted(nodeId: string, distance: number) {
      events.push({ type: 'started', nodeId, distance });
    },
    revealCompleted(nodeId: string) {
      events.push({ type: 'completed', nodeId });
    },
  };
}

describe('reveal distance via probe', () => {
  it('reports distance 1 for siblings of the focused node', () => {
    const parentMap = makeTestTree();
    const probe = makeProbe();
    const animator = new RevealAnimator(probe);

    // d focused; e is sibling
    animator.update(new Set(['d']), 0.9, 'd', parentMap, 0);
    animator.update(new Set(['d', 'e']), 0.7, 'd', parentMap, 0);

    expect(probe.events[0]).toEqual({ type: 'started', nodeId: 'e', distance: 1 });
  });

  it('reports distance 2 for the parent of the focused node', () => {
    const parentMap = makeTestTree();
    const probe = makeProbe();
    const animator = new RevealAnimator(probe);

    // d focused; b is parent
    animator.update(new Set(['d']), 0.9, 'd', parentMap, 0);
    animator.update(new Set(['d', 'b']), 0.7, 'd', parentMap, 0);

    expect(probe.events[0]).toEqual({ type: 'started', nodeId: 'b', distance: 2 });
  });

  it('reports distance 3 for uncles (siblings of parent)', () => {
    const parentMap = makeTestTree();
    const probe = makeProbe();
    const animator = new RevealAnimator(probe);

    // d focused; a is uncle (sibling of parent b)
    animator.update(new Set(['d']), 0.9, 'd', parentMap, 0);
    animator.update(new Set(['d', 'a']), 0.7, 'd', parentMap, 0);

    expect(probe.events[0]).toEqual({ type: 'started', nodeId: 'a', distance: 3 });
  });

  it('reports distance 4 for grandparent', () => {
    const parentMap = makeTestTree();
    const probe = makeProbe();
    const animator = new RevealAnimator(probe);

    // d focused; root is grandparent
    animator.update(new Set(['d']), 0.9, 'd', parentMap, 0);
    animator.update(new Set(['d', 'root']), 0.7, 'd', parentMap, 0);

    expect(probe.events[0]).toEqual({ type: 'started', nodeId: 'root', distance: 4 });
  });

  it('sibling distance is lower than parent distance', () => {
    const parentMap = makeTestTree();
    const probe = makeProbe();
    const animator = new RevealAnimator(probe);

    animator.update(new Set(['d']), 0.9, 'd', parentMap, 0);
    animator.update(new Set(['d', 'e', 'b']), 0.7, 'd', parentMap, 0);

    const siblingEvent = probe.events.find(e => e.nodeId === 'e')!;
    const parentEvent = probe.events.find(e => e.nodeId === 'b')!;
    expect(siblingEvent.distance).toBeLessThan(parentEvent.distance!);
  });

  it('parent distance is lower than uncle distance', () => {
    const parentMap = makeTestTree();
    const probe = makeProbe();
    const animator = new RevealAnimator(probe);

    animator.update(new Set(['d']), 0.9, 'd', parentMap, 0);
    animator.update(new Set(['d', 'b', 'a']), 0.7, 'd', parentMap, 0);

    const parentEvent = probe.events.find(e => e.nodeId === 'b')!;
    const uncleEvent = probe.events.find(e => e.nodeId === 'a')!;
    expect(parentEvent.distance).toBeLessThan(uncleEvent.distance!);
  });
});

describe('RevealAnimator', () => {
  describe('zoom-out reveal', () => {
    it('nodes entering viewport during zoom-out start at 90% scale', () => {
      const parentMap = makeTestTree();
      const probe = makeProbe();
      const animator = new RevealAnimator(probe);

      // First frame: only 'b' is visible, zoom level 0.8
      animator.update(new Set(['b']), 0.8, 'b', parentMap, 0);

      // Second frame: zoom out to 0.6, 'a' and 'c' become visible
      const scales = animator.update(new Set(['b', 'a', 'c']), 0.6, 'b', parentMap, 16);

      expect(scales.get('a')).toBe(0.9);
      expect(scales.get('c')).toBe(0.9);
    });

    it('nodes reach 100% scale after 150ms', () => {
      const parentMap = makeTestTree();
      const animator = new RevealAnimator();

      // Frame 1: only 'b' visible
      animator.update(new Set(['b']), 0.8, 'b', parentMap, 0);

      // Frame 2: zoom out, 'a' appears (sibling, distance 1, delay = 30ms)
      animator.update(new Set(['b', 'a']), 0.6, 'b', parentMap, 16);

      // Advance 30ms (past stagger delay) + 150ms = 180ms total
      const scales = animator.update(new Set(['b', 'a']), 0.6, 'b', parentMap, 180);

      // After delay(30ms) + duration(150ms) = 180ms, animation should be complete
      expect(scales.has('a')).toBe(false); // completed, scale is 1.0 (no entry)
    });

    it('reveal scale interpolates between 0.9 and 1.0 during animation', () => {
      const parentMap = makeTestTree();
      const animator = new RevealAnimator();

      animator.update(new Set(['b']), 0.8, 'b', parentMap, 0);

      // 'a' appears as sibling (distance=1, delay=30ms)
      animator.update(new Set(['b', 'a']), 0.6, 'b', parentMap, 0);

      // After 30ms delay + 75ms (halfway through 150ms animation)
      const scales = animator.update(new Set(['b', 'a']), 0.6, 'b', parentMap, 105);

      const scale = scales.get('a')!;
      expect(scale).toBeGreaterThan(0.9);
      expect(scale).toBeLessThan(1.0);
    });

    it('siblings reveal before parent during zoom-out', () => {
      const parentMap = makeTestTree();
      const probe = makeProbe();
      const animator = new RevealAnimator(probe);

      // d is focused, only d visible
      animator.update(new Set(['d']), 0.9, 'd', parentMap, 0);

      // Zoom out: e (sibling), b (parent) become visible
      animator.update(new Set(['d', 'e', 'b']), 0.7, 'd', parentMap, 0);

      // After 30ms: sibling 'e' (distance=1, delay=30ms) should have started animating
      // parent 'b' (distance=2, delay=60ms) should still be at start scale
      const scales = animator.update(new Set(['d', 'e', 'b']), 0.7, 'd', parentMap, 45);

      const siblingScale = scales.get('e')!;
      const parentScale = scales.get('b')!;

      // Sibling should be further along (higher scale) than parent
      expect(siblingScale).toBeGreaterThan(parentScale);
    });
  });

  describe('no reveal on zoom-in or pan', () => {
    it('no reveal animation on zoom-in', () => {
      const parentMap = makeTestTree();
      const probe = makeProbe();
      const animator = new RevealAnimator(probe);

      // Start zoomed out with many nodes visible
      animator.update(new Set(['root', 'a', 'b', 'c']), 0.3, 'b', parentMap, 0);

      // Zoom IN to 0.5, new nodes 'd' and 'e' appear (from deeper zoom)
      const scales = animator.update(new Set(['root', 'a', 'b', 'c', 'd', 'e']), 0.5, 'b', parentMap, 16);

      // No reveal animations should start
      expect(scales.size).toBe(0);
      expect(probe.events.filter(e => e.type === 'started').length).toBe(0);
    });

    it('no reveal animation on pan (same zoom level)', () => {
      const parentMap = makeTestTree();
      const probe = makeProbe();
      const animator = new RevealAnimator(probe);

      animator.update(new Set(['b']), 0.5, 'b', parentMap, 0);

      // Same zoom level, new nodes appear (from panning)
      const scales = animator.update(new Set(['b', 'a', 'c']), 0.5, 'b', parentMap, 16);

      expect(scales.size).toBe(0);
      expect(probe.events.filter(e => e.type === 'started').length).toBe(0);
    });
  });

  describe('probe events', () => {
    it('fires revealStarted with correct distance', () => {
      const parentMap = makeTestTree();
      const probe = makeProbe();
      const animator = new RevealAnimator(probe);

      animator.update(new Set(['d']), 0.9, 'd', parentMap, 0);
      animator.update(new Set(['d', 'e']), 0.7, 'd', parentMap, 0);

      const startEvents = probe.events.filter(e => e.type === 'started');
      expect(startEvents).toHaveLength(1);
      expect(startEvents[0].nodeId).toBe('e');
      expect(startEvents[0].distance).toBe(1); // sibling
    });

    it('fires revealCompleted when animation finishes', () => {
      const parentMap = makeTestTree();
      const probe = makeProbe();
      const animator = new RevealAnimator(probe);

      animator.update(new Set(['d']), 0.9, 'd', parentMap, 0);
      // 'e' appears (sibling, distance=1, delay=30ms)
      animator.update(new Set(['d', 'e']), 0.7, 'd', parentMap, 0);

      // Advance past delay + duration: 30 + 150 = 180ms
      animator.update(new Set(['d', 'e']), 0.7, 'd', parentMap, 200);

      const completedEvents = probe.events.filter(e => e.type === 'completed');
      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].nodeId).toBe('e');
    });
  });

  describe('isAnimating', () => {
    it('returns false when no animations are running', () => {
      const animator = new RevealAnimator();
      expect(animator.isAnimating).toBe(false);
    });

    it('returns true during reveal animation', () => {
      const parentMap = makeTestTree();
      const animator = new RevealAnimator();

      animator.update(new Set(['b']), 0.8, 'b', parentMap, 0);
      animator.update(new Set(['b', 'a']), 0.6, 'b', parentMap, 0);

      expect(animator.isAnimating).toBe(true);
    });

    it('returns false after all animations complete', () => {
      const parentMap = makeTestTree();
      const animator = new RevealAnimator();

      animator.update(new Set(['b']), 0.8, 'b', parentMap, 0);
      animator.update(new Set(['b', 'a']), 0.6, 'b', parentMap, 0);

      // Advance well past all animations (sibling delay=30ms + 150ms = 180ms)
      animator.update(new Set(['b', 'a']), 0.6, 'b', parentMap, 300);

      expect(animator.isAnimating).toBe(false);
    });
  });

  describe('already-visible nodes', () => {
    it('does not animate nodes that were already visible', () => {
      const parentMap = makeTestTree();
      const probe = makeProbe();
      const animator = new RevealAnimator(probe);

      animator.update(new Set(['b', 'a']), 0.8, 'b', parentMap, 0);

      // Zoom out, but 'a' was already visible
      const scales = animator.update(new Set(['b', 'a', 'c']), 0.6, 'b', parentMap, 16);

      // Only 'c' should get a reveal animation, not 'a'
      const startEvents = probe.events.filter(e => e.type === 'started');
      expect(startEvents).toHaveLength(1);
      expect(startEvents[0].nodeId).toBe('c');
    });
  });

  describe('stagger timing', () => {
    it('staggers by ~30ms per relationship distance', () => {
      const parentMap = makeTestTree();
      const animator = new RevealAnimator();

      // d is focused
      animator.update(new Set(['d']), 0.9, 'd', parentMap, 0);

      // Zoom out: e (sibling, dist=1), b (parent, dist=2), a (uncle, dist=3) all appear
      animator.update(new Set(['d', 'e', 'b', 'a']), 0.5, 'd', parentMap, 0);

      // At t=31ms: e (delay=30ms) should have just started, b (delay=60ms) still waiting, a (delay=90ms) still waiting
      const scales31 = animator.update(new Set(['d', 'e', 'b', 'a']), 0.5, 'd', parentMap, 31);
      expect(scales31.get('e')!).toBeGreaterThan(0.9); // started animating
      expect(scales31.get('b')!).toBe(0.9); // still in stagger delay
      expect(scales31.get('a')!).toBe(0.9); // still in stagger delay

      // At t=61ms more: b (delay=60ms) should have started, a (delay=90ms) still waiting
      const scales92 = animator.update(new Set(['d', 'e', 'b', 'a']), 0.5, 'd', parentMap, 31);
      // Total elapsed = 31 + 31 = 62ms
      expect(scales92.get('b')!).toBeGreaterThan(0.9); // started animating (62 > 60)
      expect(scales92.get('a')!).toBe(0.9); // still waiting (62 < 90)
    });
  });
});
