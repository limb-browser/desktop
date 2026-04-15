// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { AnimationCoordinator } from './AnimationCoordinator.mjs';
import type { AnimationCoordinatorProbe } from '../ports/AnimationCoordinatorProbe';

/**
 * @typedef {{ tick(deltaMs: number): boolean, cancel(): void }} CoordinatedAnimation
 */

function createProbe() {
  const calls: { type: string; property?: string; priority?: string }[] = [];
  const probe: AnimationCoordinatorProbe = {
    animationRegistered(property, priority) {
      calls.push({ type: 'registered', property, priority });
    },
    animationCancelled(property) {
      calls.push({ type: 'cancelled', property });
    },
    animationCompleted(property) {
      calls.push({ type: 'completed', property });
    },
  };
  return { probe, calls };
}

function createFakeClock() {
  let time = 0;
  return {
    now: () => time,
    advance: (ms: number) => { time += ms; },
  };
}

function createFakeAnimation(options?: { duration?: number }) {
  const duration = options?.duration ?? 100;
  let elapsed = 0;
  let cancelled = false;
  const receivedDeltas: number[] = [];
  return {
    animation: {
      tick(deltaMs: number): boolean {
        receivedDeltas.push(deltaMs);
        elapsed += deltaMs;
        return elapsed >= duration;
      },
      cancel() {
        cancelled = true;
      },
    },
    get elapsed() { return elapsed; },
    get cancelled() { return cancelled; },
    get receivedDeltas() { return receivedDeltas; },
  };
}

function setup() {
  const clock = createFakeClock();
  const { probe, calls } = createProbe();
  const dirtyCount = { value: 0 };
  const coordinator = new AnimationCoordinator(probe, {
    now: clock.now,
    markDirty: () => { dirtyCount.value++; },
  });
  return { coordinator, clock, calls, dirtyCount };
}

describe('AnimationCoordinator', () => {
  describe('two animations on the same property: first is cancelled when second starts', () => {
    it('cancels the first animation when a second registers on the same property', () => {
      const { coordinator, calls } = setup();
      const first = createFakeAnimation();
      const second = createFakeAnimation();

      coordinator.register('zoom', first.animation, 'programmatic');
      coordinator.register('zoom', second.animation, 'programmatic');

      expect(first.cancelled).toBe(true);
      expect(calls.filter(c => c.type === 'cancelled' && c.property === 'zoom')).toHaveLength(1);
    });

    it('second animation takes over and runs on subsequent ticks', () => {
      const { coordinator, clock } = setup();
      const first = createFakeAnimation();
      const second = createFakeAnimation({ duration: 200 });

      coordinator.register('zoom', first.animation, 'programmatic');
      coordinator.register('zoom', second.animation, 'programmatic');

      clock.advance(16);
      coordinator.tick();

      expect(second.receivedDeltas).toHaveLength(1);
      expect(second.elapsed).toBe(16);
      // First should not have received any ticks after being cancelled
      expect(first.receivedDeltas).toHaveLength(0);
    });

    it('fires registered probe for both, cancelled for first', () => {
      const { coordinator, calls } = setup();
      const first = createFakeAnimation();
      const second = createFakeAnimation();

      coordinator.register('zoom', first.animation, 'programmatic');
      coordinator.register('zoom', second.animation, 'programmatic');

      expect(calls).toEqual([
        { type: 'registered', property: 'zoom', priority: 'programmatic' },
        { type: 'cancelled', property: 'zoom' },
        { type: 'registered', property: 'zoom', priority: 'programmatic' },
      ]);
    });
  });

  describe('animations on different properties run concurrently without interference', () => {
    it('allows two animations on different properties to run simultaneously', () => {
      const { coordinator, clock } = setup();
      const zoomAnim = createFakeAnimation({ duration: 200 });
      const layoutAnim = createFakeAnimation({ duration: 200 });

      coordinator.register('zoom', zoomAnim.animation, 'programmatic');
      coordinator.register('layout', layoutAnim.animation, 'programmatic');

      clock.advance(16);
      coordinator.tick();

      expect(zoomAnim.receivedDeltas).toHaveLength(1);
      expect(layoutAnim.receivedDeltas).toHaveLength(1);
      expect(zoomAnim.elapsed).toBe(16);
      expect(layoutAnim.elapsed).toBe(16);
    });

    it('does not cancel one when the other is registered', () => {
      const { coordinator } = setup();
      const zoomAnim = createFakeAnimation();
      const layoutAnim = createFakeAnimation();

      coordinator.register('zoom', zoomAnim.animation, 'programmatic');
      coordinator.register('layout', layoutAnim.animation, 'programmatic');

      expect(zoomAnim.cancelled).toBe(false);
      expect(layoutAnim.cancelled).toBe(false);
    });

    it('reports correct active count with concurrent animations', () => {
      const { coordinator } = setup();
      const zoomAnim = createFakeAnimation();
      const layoutAnim = createFakeAnimation();

      coordinator.register('zoom', zoomAnim.animation, 'programmatic');
      coordinator.register('layout', layoutAnim.animation, 'programmatic');

      expect(coordinator.activeCount).toBe(2);
      expect(coordinator.isActive('zoom')).toBe(true);
      expect(coordinator.isActive('layout')).toBe(true);
    });
  });

  describe('user input cancels programmatic animations', () => {
    it('cancelProgrammatic cancels all programmatic animations', () => {
      const { coordinator } = setup();
      const zoomAnim = createFakeAnimation();
      const layoutAnim = createFakeAnimation();

      coordinator.register('zoom', zoomAnim.animation, 'programmatic');
      coordinator.register('layout', layoutAnim.animation, 'programmatic');

      coordinator.cancelProgrammatic();

      expect(zoomAnim.cancelled).toBe(true);
      expect(layoutAnim.cancelled).toBe(true);
      expect(coordinator.activeCount).toBe(0);
    });

    it('cancelProgrammatic does not cancel user-input animations', () => {
      const { coordinator } = setup();
      const programmatic = createFakeAnimation();
      const userInput = createFakeAnimation();

      coordinator.register('zoom', programmatic.animation, 'programmatic');
      coordinator.register('momentum', userInput.animation, 'user-input');

      coordinator.cancelProgrammatic();

      expect(programmatic.cancelled).toBe(true);
      expect(userInput.cancelled).toBe(false);
      expect(coordinator.activeCount).toBe(1);
      expect(coordinator.isActive('momentum')).toBe(true);
    });

    it('fires cancelled probe for each programmatic animation', () => {
      const { coordinator, calls } = setup();
      const zoomAnim = createFakeAnimation();
      const layoutAnim = createFakeAnimation();

      coordinator.register('zoom', zoomAnim.animation, 'programmatic');
      coordinator.register('layout', layoutAnim.animation, 'programmatic');
      calls.length = 0;

      coordinator.cancelProgrammatic();

      const cancelledEvents = calls.filter(c => c.type === 'cancelled');
      expect(cancelledEvents).toHaveLength(2);
      expect(cancelledEvents.map(c => c.property).sort()).toEqual(['layout', 'zoom']);
    });
  });

  describe('completed animations are fully cleaned up', () => {
    it('removes animation from registry when tick returns done', () => {
      const { coordinator, clock } = setup();
      const anim = createFakeAnimation({ duration: 50 });

      coordinator.register('zoom', anim.animation, 'programmatic');
      expect(coordinator.isActive('zoom')).toBe(true);

      clock.advance(60);
      coordinator.tick();

      expect(coordinator.isActive('zoom')).toBe(false);
      expect(coordinator.activeCount).toBe(0);
    });

    it('fires completed probe when animation finishes', () => {
      const { coordinator, clock, calls } = setup();
      const anim = createFakeAnimation({ duration: 50 });

      coordinator.register('zoom', anim.animation, 'programmatic');
      calls.length = 0;

      clock.advance(60);
      coordinator.tick();

      expect(calls).toEqual([
        { type: 'completed', property: 'zoom' },
      ]);
    });

    it('does not call markDirty after all animations complete', () => {
      const { coordinator, clock, dirtyCount } = setup();
      const anim = createFakeAnimation({ duration: 50 });

      coordinator.register('zoom', anim.animation, 'programmatic');
      dirtyCount.value = 0;

      clock.advance(60);
      coordinator.tick();

      // Should NOT have called markDirty since no animations remain
      expect(dirtyCount.value).toBe(0);
    });

    it('does not tick completed animation on subsequent frames', () => {
      const { coordinator, clock } = setup();
      const anim = createFakeAnimation({ duration: 50 });

      coordinator.register('zoom', anim.animation, 'programmatic');

      clock.advance(60);
      coordinator.tick();
      expect(anim.receivedDeltas).toHaveLength(1);

      clock.advance(16);
      coordinator.tick();
      // Should not have received another tick
      expect(anim.receivedDeltas).toHaveLength(1);
    });
  });

  describe('cancelAll stops all active animations', () => {
    it('cancels all animations regardless of priority', () => {
      const { coordinator } = setup();
      const prog = createFakeAnimation();
      const user = createFakeAnimation();

      coordinator.register('zoom', prog.animation, 'programmatic');
      coordinator.register('momentum', user.animation, 'user-input');

      coordinator.cancelAll();

      expect(prog.cancelled).toBe(true);
      expect(user.cancelled).toBe(true);
      expect(coordinator.activeCount).toBe(0);
      expect(coordinator.hasActiveAnimations).toBe(false);
    });

    it('fires cancelled probe for each animation', () => {
      const { coordinator, calls } = setup();
      const a = createFakeAnimation();
      const b = createFakeAnimation();

      coordinator.register('zoom', a.animation, 'programmatic');
      coordinator.register('layout', b.animation, 'programmatic');
      calls.length = 0;

      coordinator.cancelAll();

      const cancelledEvents = calls.filter(c => c.type === 'cancelled');
      expect(cancelledEvents).toHaveLength(2);
    });

    it('no-ops when no animations are active', () => {
      const { coordinator, calls } = setup();

      coordinator.cancelAll();

      expect(calls).toHaveLength(0);
    });
  });

  describe('shared time source is consistent across concurrent animations', () => {
    it('all animations receive the same deltaMs in a single tick', () => {
      const { coordinator, clock } = setup();
      const zoomAnim = createFakeAnimation({ duration: 500 });
      const layoutAnim = createFakeAnimation({ duration: 500 });

      coordinator.register('zoom', zoomAnim.animation, 'programmatic');
      coordinator.register('layout', layoutAnim.animation, 'programmatic');

      clock.advance(16);
      coordinator.tick();

      expect(zoomAnim.receivedDeltas[0]).toBe(16);
      expect(layoutAnim.receivedDeltas[0]).toBe(16);
      expect(zoomAnim.receivedDeltas[0]).toBe(layoutAnim.receivedDeltas[0]);
    });

    it('deltaMs reflects actual time between ticks', () => {
      const { coordinator, clock } = setup();
      const anim = createFakeAnimation({ duration: 500 });

      coordinator.register('zoom', anim.animation, 'programmatic');

      clock.advance(16);
      coordinator.tick();

      clock.advance(32);
      coordinator.tick();

      expect(anim.receivedDeltas[0]).toBe(16);
      expect(anim.receivedDeltas[1]).toBe(32);
    });

    it('first tick after registration uses deltaMs from registration time', () => {
      const { coordinator, clock } = setup();

      clock.advance(100); // advance before registration
      const anim = createFakeAnimation({ duration: 500 });
      coordinator.register('zoom', anim.animation, 'programmatic');

      clock.advance(16);
      coordinator.tick();

      // deltaMs should be 16 (time since registration), not 116
      expect(anim.receivedDeltas[0]).toBe(16);
    });

    it('now() returns the shared time source value', () => {
      const { coordinator, clock } = setup();

      clock.advance(42);
      expect(coordinator.now()).toBe(42);

      clock.advance(58);
      expect(coordinator.now()).toBe(100);
    });
  });

  describe('markDirty integration with FrameScheduler', () => {
    it('calls markDirty when a new animation is registered', () => {
      const { coordinator, dirtyCount } = setup();
      const anim = createFakeAnimation();

      coordinator.register('zoom', anim.animation, 'programmatic');

      expect(dirtyCount.value).toBe(1);
    });

    it('calls markDirty after tick if animations remain active', () => {
      const { coordinator, clock, dirtyCount } = setup();
      const anim = createFakeAnimation({ duration: 200 });

      coordinator.register('zoom', anim.animation, 'programmatic');
      dirtyCount.value = 0;

      clock.advance(16);
      coordinator.tick();

      expect(dirtyCount.value).toBe(1);
    });

    it('does not call markDirty after tick if all animations completed', () => {
      const { coordinator, clock, dirtyCount } = setup();
      const anim = createFakeAnimation({ duration: 50 });

      coordinator.register('zoom', anim.animation, 'programmatic');
      dirtyCount.value = 0;

      clock.advance(60);
      coordinator.tick();

      expect(dirtyCount.value).toBe(0);
    });

    it('does not call markDirty when tick has no animations', () => {
      const { coordinator, dirtyCount } = setup();

      coordinator.tick();

      expect(dirtyCount.value).toBe(0);
    });
  });

  describe('hasActiveAnimations and activeCount', () => {
    it('hasActiveAnimations is false when no animations are registered', () => {
      const { coordinator } = setup();
      expect(coordinator.hasActiveAnimations).toBe(false);
    });

    it('hasActiveAnimations is true when an animation is registered', () => {
      const { coordinator } = setup();
      coordinator.register('zoom', createFakeAnimation().animation, 'programmatic');
      expect(coordinator.hasActiveAnimations).toBe(true);
    });

    it('activeCount tracks the number of registered animations', () => {
      const { coordinator } = setup();
      expect(coordinator.activeCount).toBe(0);

      coordinator.register('zoom', createFakeAnimation().animation, 'programmatic');
      expect(coordinator.activeCount).toBe(1);

      coordinator.register('layout', createFakeAnimation().animation, 'programmatic');
      expect(coordinator.activeCount).toBe(2);
    });
  });

  describe('cancel(property) cancels a single property animation', () => {
    it('cancels the animation and removes it from the registry', () => {
      const { coordinator } = setup();
      const anim = createFakeAnimation();

      coordinator.register('zoom', anim.animation, 'programmatic');
      coordinator.cancel('zoom');

      expect(anim.cancelled).toBe(true);
      expect(coordinator.isActive('zoom')).toBe(false);
      expect(coordinator.activeCount).toBe(0);
    });

    it('does not affect animations on other properties', () => {
      const { coordinator } = setup();
      const zoomAnim = createFakeAnimation();
      const layoutAnim = createFakeAnimation();

      coordinator.register('zoom', zoomAnim.animation, 'programmatic');
      coordinator.register('layout', layoutAnim.animation, 'programmatic');

      coordinator.cancel('zoom');

      expect(zoomAnim.cancelled).toBe(true);
      expect(layoutAnim.cancelled).toBe(false);
      expect(coordinator.isActive('zoom')).toBe(false);
      expect(coordinator.isActive('layout')).toBe(true);
      expect(coordinator.activeCount).toBe(1);
    });

    it('fires cancelled probe for the cancelled property', () => {
      const { coordinator, calls } = setup();
      const anim = createFakeAnimation();
      coordinator.register('zoom', anim.animation, 'programmatic');
      calls.length = 0;

      coordinator.cancel('zoom');

      expect(calls).toEqual([
        { type: 'cancelled', property: 'zoom' },
      ]);
    });

    it('no-ops when the property has no active animation', () => {
      const { coordinator, calls } = setup();

      coordinator.cancel('zoom');

      expect(calls).toHaveLength(0);
      expect(coordinator.activeCount).toBe(0);
    });

    it('prevents stale adapter from ticking after cancel', () => {
      const { coordinator, clock } = setup();
      const anim = createFakeAnimation({ duration: 200 });

      coordinator.register('zoom', anim.animation, 'programmatic');
      clock.advance(16);
      coordinator.tick();
      expect(anim.receivedDeltas).toHaveLength(1);

      coordinator.cancel('zoom');

      clock.advance(16);
      coordinator.tick();
      // Should not have received another tick after cancel
      expect(anim.receivedDeltas).toHaveLength(1);
    });
  });

  describe('probe events', () => {
    it('fires animationRegistered on register', () => {
      const { coordinator, calls } = setup();
      coordinator.register('zoom', createFakeAnimation().animation, 'programmatic');

      expect(calls).toEqual([
        { type: 'registered', property: 'zoom', priority: 'programmatic' },
      ]);
    });

    it('fires animationCancelled on cancel', () => {
      const { coordinator, calls } = setup();
      const anim = createFakeAnimation();
      coordinator.register('zoom', anim.animation, 'programmatic');
      calls.length = 0;

      coordinator.cancelAll();

      expect(calls).toEqual([
        { type: 'cancelled', property: 'zoom' },
      ]);
    });

    it('fires animationCompleted when animation finishes naturally', () => {
      const { coordinator, clock, calls } = setup();
      coordinator.register('zoom', createFakeAnimation({ duration: 50 }).animation, 'programmatic');
      calls.length = 0;

      clock.advance(60);
      coordinator.tick();

      expect(calls).toEqual([
        { type: 'completed', property: 'zoom' },
      ]);
    });

    it('works without a probe', () => {
      const clock = createFakeClock();
      const coordinator = new AnimationCoordinator(null, { now: clock.now });
      const anim = createFakeAnimation({ duration: 50 });

      coordinator.register('zoom', anim.animation, 'programmatic');
      clock.advance(60);
      coordinator.tick();

      expect(coordinator.activeCount).toBe(0);
    });
  });
});
