import { describe, it, expect } from 'vitest';
import { ZoomMomentum } from './momentum';

describe('ZoomMomentum', () => {
  describe('friction — velocity halves every 120ms', () => {
    it('halves velocity after 120ms', () => {
      const m = new ZoomMomentum();
      // Record 3 rapid scrolls within 150ms to produce a sustained gesture
      m.recordScroll(0, 0.1);
      m.recordScroll(40, 0.1);
      m.recordScroll(80, 0.1);
      const v0 = m.release(80);
      expect(v0).toBeGreaterThan(0);

      // After 120ms, velocity should halve — verify via two consecutive ticks
      const r1 = m.tick(120);
      const r2 = m.tick(120);
      // Each 120ms tick halves the velocity, so the level delta halves too
      expect(r2.level).toBeCloseTo(r1.level / 2, 5);
      expect(r1.done).toBe(false);
    });

    it('quarters velocity after 240ms (two halvings)', () => {
      const m = new ZoomMomentum();
      m.recordScroll(0, 0.1);
      m.recordScroll(40, 0.1);
      m.recordScroll(80, 0.1);
      const v0 = m.release(80);

      const r1 = m.tick(120);
      const r2 = m.tick(120);

      // After first 120ms: velocity was v0, halved to v0/2
      // After second 120ms: velocity was v0/2, halved to v0/4
      // Total level delta = r1.level + r2.level
      // r1.level ≈ v0 * 120 * 0.5 (integral of exponential decay over 120ms)
      // But we need to check velocity, not just level
      // Let's verify by checking the ratio of consecutive level deltas
      expect(r2.level).toBeCloseTo(r1.level / 2, 5);
    });
  });

  describe('minimum velocity threshold', () => {
    it('stops when velocity drops below 0.001 zoom-units/ms', () => {
      const m = new ZoomMomentum();
      m.recordScroll(0, 0.001);
      m.recordScroll(40, 0.001);
      m.recordScroll(80, 0.001);
      m.release(80);

      // Tick enough to decay below threshold
      let done = false;
      let iterations = 0;
      while (!done && iterations < 1000) {
        const result = m.tick(120);
        done = result.done;
        iterations++;
      }
      expect(done).toBe(true);
    });

    it('returns done=true once below threshold', () => {
      const m = new ZoomMomentum();
      // Use a very small velocity that will quickly decay below 0.001
      m.recordScroll(0, 0.002);
      m.recordScroll(40, 0.002);
      m.recordScroll(80, 0.002);
      m.release(80);

      // Keep ticking until done
      let result = m.tick(120);
      while (!result.done) {
        result = m.tick(120);
      }
      expect(result.done).toBe(true);
      // Further ticks should also be done with zero level change
      const after = m.tick(120);
      expect(after.done).toBe(true);
      expect(after.level).toBe(0);
    });
  });

  describe('interruption — new scroll cancels momentum', () => {
    it('cancels active momentum on interrupt()', () => {
      const m = new ZoomMomentum();
      m.recordScroll(0, 0.5);
      m.recordScroll(40, 0.5);
      m.recordScroll(80, 0.5);
      m.release(80);

      // Momentum is active
      const before = m.tick(60);
      expect(before.level).not.toBe(0);
      expect(before.done).toBe(false);

      // Interrupt
      m.interrupt();

      // After interrupt, tick should report done
      const after = m.tick(60);
      expect(after.level).toBe(0);
      expect(after.done).toBe(true);
    });

    it('new recordScroll cancels active momentum', () => {
      const m = new ZoomMomentum();
      m.recordScroll(0, 0.5);
      m.recordScroll(40, 0.5);
      m.recordScroll(80, 0.5);
      m.release(80);

      // Momentum is active
      const before = m.tick(60);
      expect(before.done).toBe(false);

      // New scroll input interrupts
      m.recordScroll(200, 0.3);

      // After new scroll, momentum should be cancelled
      const after = m.tick(60);
      expect(after.level).toBe(0);
      expect(after.done).toBe(true);
    });
  });

  describe('velocity tracking', () => {
    it('single isolated tick produces zero release velocity', () => {
      const m = new ZoomMomentum();
      m.recordScroll(0, 0.1);
      // Only 1 event — not a sustained gesture
      const velocity = m.release(0);
      expect(velocity).toBe(0);
    });

    it('two scroll events produce zero release velocity (need 3)', () => {
      const m = new ZoomMomentum();
      m.recordScroll(0, 0.1);
      m.recordScroll(50, 0.1);
      const velocity = m.release(50);
      expect(velocity).toBe(0);
    });

    it('three rapid scrolls within 150ms produce nonzero release velocity', () => {
      const m = new ZoomMomentum();
      m.recordScroll(0, 0.1);
      m.recordScroll(50, 0.1);
      m.recordScroll(100, 0.1);
      const velocity = m.release(100);
      expect(velocity).not.toBe(0);
      expect(velocity).toBeGreaterThan(0);
    });

    it('scrolls older than 150ms are excluded from velocity computation', () => {
      const m = new ZoomMomentum();
      // First scroll is old (at t=0), then a gap, then two recent scrolls
      m.recordScroll(0, 0.5);
      m.recordScroll(200, 0.1);
      m.recordScroll(250, 0.1);
      // At release time 250ms, the event at t=0 is 250ms old (> 150ms), excluded
      // Only 2 events remain within window — not enough for momentum
      const velocity = m.release(250);
      expect(velocity).toBe(0);
    });

    it('computes velocity from deltas over time span of recent events', () => {
      const m = new ZoomMomentum();
      m.recordScroll(100, 0.3);
      m.recordScroll(140, 0.3);
      m.recordScroll(180, 0.3);
      // 3 events within 80ms (< 150ms)
      // Total delta = 0.9 over 80ms = 0.01125 zoom-units/ms
      const velocity = m.release(180);
      expect(velocity).toBeCloseTo(0.9 / 80, 8);
    });

    it('only keeps last 3 scroll events', () => {
      const m = new ZoomMomentum();
      m.recordScroll(0, 1.0);   // will be dropped (only last 3 kept)
      m.recordScroll(30, 0.1);
      m.recordScroll(60, 0.1);
      m.recordScroll(90, 0.1);
      // Last 3: t=30 (delta=0.1), t=60 (delta=0.1), t=90 (delta=0.1)
      // Total delta = 0.3, time span = 60ms
      const velocity = m.release(90);
      expect(velocity).toBeCloseTo(0.3 / 60, 8);
    });

    it('preserves sign of delta for negative (zoom-out) scrolls', () => {
      const m = new ZoomMomentum();
      m.recordScroll(0, -0.1);
      m.recordScroll(50, -0.1);
      m.recordScroll(100, -0.1);
      const velocity = m.release(100);
      expect(velocity).toBeLessThan(0);
    });
  });

  describe('tick applies friction with correct sign', () => {
    it('applies friction to negative velocity correctly', () => {
      const m = new ZoomMomentum();
      m.recordScroll(0, -0.1);
      m.recordScroll(40, -0.1);
      m.recordScroll(80, -0.1);
      m.release(80);

      const result = m.tick(120);
      expect(result.level).toBeLessThan(0);
      expect(result.done).toBe(false);
    });
  });
});
