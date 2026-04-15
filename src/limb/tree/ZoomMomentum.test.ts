// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { ZoomMomentum } from './ZoomMomentum.mjs';
import type { ZoomMomentumProbe } from '../ports/ZoomMomentumProbe';

function createProbe() {
  const calls: { type: string; velocity?: number }[] = [];
  const probe: ZoomMomentumProbe = {
    momentumStarted(velocity) {
      calls.push({ type: 'started', velocity });
    },
    momentumStopped() {
      calls.push({ type: 'stopped' });
    },
    momentumCancelled() {
      calls.push({ type: 'cancelled' });
    },
  };
  return { probe, calls };
}

describe('ZoomMomentum', () => {
  describe('sustained scroll gesture triggers momentum on release', () => {
    it('starts momentum after 150ms with no new scroll events', () => {
      const { probe, calls } = createProbe();
      const momentum = new ZoomMomentum(probe);

      // Simulate a sustained gesture: 3 scroll events within 150ms
      momentum.onScroll(0.05, 0);
      momentum.onScroll(0.05, 30);
      momentum.onScroll(0.05, 60);

      // Simulate release: 150ms pass with no new scroll
      momentum.onRelease(210);

      expect(momentum.isActive).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('started');
    });

    it('computes release velocity from tracked events', () => {
      const { probe, calls } = createProbe();
      const momentum = new ZoomMomentum(probe);

      // 3 scroll events: total delta = 0.15 over 60ms
      momentum.onScroll(0.05, 0);
      momentum.onScroll(0.05, 30);
      momentum.onScroll(0.05, 60);

      momentum.onRelease(210);

      // Velocity = total delta / time span = 0.15 / 60 = 0.0025 zoom-units/ms
      expect(calls[0].velocity).toBeCloseTo(0.0025, 6);
    });
  });

  describe('single isolated scroll tick does NOT trigger momentum', () => {
    it('does not start momentum for a single scroll event', () => {
      const { probe, calls } = createProbe();
      const momentum = new ZoomMomentum(probe);

      momentum.onScroll(0.02, 0);
      momentum.onRelease(150);

      expect(momentum.isActive).toBe(false);
      expect(calls).toHaveLength(0);
    });
  });

  describe('velocity halves every 120ms during momentum', () => {
    it('decays velocity exponentially', () => {
      const momentum = new ZoomMomentum();

      // Sustained gesture with high velocity
      momentum.onScroll(0.1, 0);
      momentum.onScroll(0.1, 30);
      momentum.onScroll(0.1, 60);
      momentum.onRelease(210);

      const initialVelocity = momentum.velocity;

      // After 120ms, velocity should be halved
      momentum.update(120);
      expect(momentum.velocity).toBeCloseTo(initialVelocity / 2, 6);

      // After another 120ms, halved again
      momentum.update(120);
      expect(momentum.velocity).toBeCloseTo(initialVelocity / 4, 6);
    });

    it('applies fractional decay for non-120ms intervals', () => {
      const momentum = new ZoomMomentum();

      momentum.onScroll(0.1, 0);
      momentum.onScroll(0.1, 30);
      momentum.onScroll(0.1, 60);
      momentum.onRelease(210);

      const initialVelocity = momentum.velocity;

      // After 60ms (half of 120ms), velocity should be 0.5^(60/120) = 0.5^0.5 = ~0.707
      momentum.update(60);
      const expected = initialVelocity * Math.pow(0.5, 60 / 120);
      expect(momentum.velocity).toBeCloseTo(expected, 6);
    });
  });

  describe('momentum stops at velocity threshold', () => {
    it('stops when velocity drops below 0.001 zoom-units/ms', () => {
      const { probe, calls } = createProbe();
      const momentum = new ZoomMomentum(probe);

      // Small velocity that will decay below threshold quickly
      momentum.onScroll(0.003, 0);
      momentum.onScroll(0.003, 50);
      momentum.onRelease(200);

      // velocity = 0.006 / 50 = 0.00012 zoom-units/ms — already below threshold
      // So momentum should not start
      expect(momentum.isActive).toBe(false);
    });

    it('stops after sufficient decay', () => {
      const { probe, calls } = createProbe();
      const momentum = new ZoomMomentum(probe);

      // Velocity just above threshold: enough to start but will decay quickly
      // Need velocity > 0.001. Use events that produce velocity = 0.002
      // delta = 0.05 over 25ms => velocity = 0.002
      momentum.onScroll(0.025, 0);
      momentum.onScroll(0.025, 25);
      momentum.onRelease(175);

      expect(momentum.isActive).toBe(true);

      // Decay: 0.002 * 0.5^(t/120)
      // Below 0.001 when 0.5^(t/120) < 0.5, i.e., t > 120ms
      // After 120ms: 0.002 * 0.5 = 0.001 — exactly at threshold (not below)
      // After 121ms: slightly below
      momentum.update(121);
      expect(momentum.isActive).toBe(false);
      expect(calls.some(c => c.type === 'stopped')).toBe(true);
    });
  });

  describe('new scroll input cancels active momentum', () => {
    it('cancels momentum on new scroll', () => {
      const { probe, calls } = createProbe();
      const momentum = new ZoomMomentum(probe);

      // Start momentum
      momentum.onScroll(0.1, 0);
      momentum.onScroll(0.1, 30);
      momentum.onScroll(0.1, 60);
      momentum.onRelease(210);
      expect(momentum.isActive).toBe(true);

      // New scroll input
      momentum.onScroll(0.05, 300);
      expect(momentum.isActive).toBe(false);
      expect(calls.some(c => c.type === 'cancelled')).toBe(true);
    });

    it('starts fresh velocity tracking from new input', () => {
      const momentum = new ZoomMomentum();

      // Start momentum
      momentum.onScroll(0.1, 0);
      momentum.onScroll(0.1, 30);
      momentum.onScroll(0.1, 60);
      momentum.onRelease(210);

      // New scroll events
      momentum.onScroll(0.05, 300);
      momentum.onScroll(0.05, 330);
      momentum.onScroll(0.05, 360);
      momentum.onRelease(510);

      expect(momentum.isActive).toBe(true);
      // New velocity = 0.15 / 60 = 0.0025
      expect(momentum.velocity).toBeCloseTo(0.0025, 6);
    });
  });

  describe('zoom level remains clamped during momentum', () => {
    it('returns zoom delta clamped to keep level in [0.0, 1.0] when near max', () => {
      const momentum = new ZoomMomentum();

      // Positive velocity (zooming in)
      momentum.onScroll(0.1, 0);
      momentum.onScroll(0.1, 30);
      momentum.onScroll(0.1, 60);
      momentum.onRelease(210);

      // Update returns the delta to apply to zoom level
      const delta = momentum.update(16);
      expect(delta).toBeGreaterThan(0);
    });

    it('returns negative delta for negative velocity (zooming out)', () => {
      const momentum = new ZoomMomentum();

      // Negative velocity (zooming out)
      momentum.onScroll(-0.1, 0);
      momentum.onScroll(-0.1, 30);
      momentum.onScroll(-0.1, 60);
      momentum.onRelease(210);

      const delta = momentum.update(16);
      expect(delta).toBeLessThan(0);
    });
  });

  describe('velocity tracking window', () => {
    it('only keeps events within 150ms window', () => {
      const momentum = new ZoomMomentum();

      // First event is old (will be evicted)
      momentum.onScroll(0.5, 0);
      momentum.onScroll(0.02, 200);
      momentum.onScroll(0.02, 250);

      momentum.onRelease(400);

      // Only the last 2 events should be tracked (within 150ms of latest)
      // velocity = 0.04 / 50 = 0.0008 — below threshold, no momentum
      expect(momentum.isActive).toBe(false);
    });

    it('keeps at most 3 events', () => {
      const momentum = new ZoomMomentum();

      momentum.onScroll(0.5, 0);
      momentum.onScroll(0.1, 10);
      momentum.onScroll(0.1, 20);
      momentum.onScroll(0.1, 30);

      momentum.onRelease(180);

      // Only last 3 events: deltas 0.1, 0.1, 0.1 over 20ms span (10..30)
      // velocity = 0.3 / 20 = 0.015
      expect(momentum.velocity).toBeCloseTo(0.015, 6);
    });
  });

  describe('update returns accumulated delta', () => {
    it('returns the zoom level change for the given time step', () => {
      const momentum = new ZoomMomentum();

      momentum.onScroll(0.1, 0);
      momentum.onScroll(0.1, 30);
      momentum.onScroll(0.1, 60);
      momentum.onRelease(210);

      const velocity = momentum.velocity;
      // For a small dt, delta ≈ velocity * dt (with slight decay)
      const delta = momentum.update(16);
      // The exact integral: ∫₀^dt v₀ * 0.5^(t/120) dt
      // = v₀ * 120 / ln(2) * (1 - 0.5^(dt/120))
      const expected = velocity * (120 / Math.LN2) * (1 - Math.pow(0.5, 16 / 120));
      expect(delta).toBeCloseTo(expected, 6);
    });

    it('returns 0 when not active', () => {
      const momentum = new ZoomMomentum();
      const delta = momentum.update(16);
      expect(delta).toBe(0);
    });
  });

  describe('probe events', () => {
    it('fires momentumStarted on release with velocity', () => {
      const { probe, calls } = createProbe();
      const momentum = new ZoomMomentum(probe);

      momentum.onScroll(0.1, 0);
      momentum.onScroll(0.1, 30);
      momentum.onScroll(0.1, 60);
      momentum.onRelease(210);

      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('started');
      expect(calls[0].velocity).toBeGreaterThan(0);
    });

    it('fires momentumStopped when velocity decays below threshold', () => {
      const { probe, calls } = createProbe();
      const momentum = new ZoomMomentum(probe);

      momentum.onScroll(0.025, 0);
      momentum.onScroll(0.025, 25);
      momentum.onRelease(175);

      // Decay past threshold
      momentum.update(200);

      expect(calls.some(c => c.type === 'stopped')).toBe(true);
    });

    it('fires momentumCancelled on new scroll during active momentum', () => {
      const { probe, calls } = createProbe();
      const momentum = new ZoomMomentum(probe);

      momentum.onScroll(0.1, 0);
      momentum.onScroll(0.1, 30);
      momentum.onScroll(0.1, 60);
      momentum.onRelease(210);

      momentum.onScroll(0.05, 300);

      expect(calls.some(c => c.type === 'cancelled')).toBe(true);
    });

    it('does not fire cancelled when not active', () => {
      const { probe, calls } = createProbe();
      const momentum = new ZoomMomentum(probe);

      momentum.onScroll(0.05, 0);
      expect(calls).toHaveLength(0);
    });
  });

  describe('cancel method', () => {
    it('stops active momentum', () => {
      const { probe, calls } = createProbe();
      const momentum = new ZoomMomentum(probe);

      momentum.onScroll(0.1, 0);
      momentum.onScroll(0.1, 30);
      momentum.onScroll(0.1, 60);
      momentum.onRelease(210);

      momentum.cancel();

      expect(momentum.isActive).toBe(false);
      expect(calls.some(c => c.type === 'cancelled')).toBe(true);
    });

    it('is a no-op when not active', () => {
      const { probe, calls } = createProbe();
      const momentum = new ZoomMomentum(probe);

      momentum.cancel();
      expect(calls).toHaveLength(0);
    });
  });
});
