import { describe, it, expect } from 'vitest';
import { PanMomentum } from './pan-momentum';

describe('PanMomentum', () => {
  const treeBounds = { x: 0, y: 0, width: 100, height: 100 };
  const insideCenter = { x: 50, y: 50 };

  describe('2D velocity deceleration — halves every 120ms per axis', () => {
    it('halves displacement independently on each axis every 120ms', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 1, 2);
      m.recordDrag(40, 1, 2);
      m.recordDrag(80, 1, 2);
      m.release(80);

      const r1 = m.tick(120, treeBounds, insideCenter);
      const center2 = { x: insideCenter.x + r1.dx, y: insideCenter.y + r1.dy };
      const r2 = m.tick(120, treeBounds, center2);

      // Each 120ms tick halves the velocity, so displacement halves
      expect(r2.dx).toBeCloseTo(r1.dx / 2, 5);
      expect(r2.dy).toBeCloseTo(r1.dy / 2, 5);
      expect(r1.done).toBe(false);
    });

    it('decelerates axes independently with different velocities', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 3, 1);
      m.recordDrag(40, 3, 1);
      m.recordDrag(80, 3, 1);
      m.release(80);

      const r1 = m.tick(120, treeBounds, insideCenter);
      // dx should be 3x dy since velocity ratio is 3:1
      expect(r1.dx / r1.dy).toBeCloseTo(3, 5);
    });

    it('quarters displacement after 240ms (two halvings)', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 2, 4);
      m.recordDrag(40, 2, 4);
      m.recordDrag(80, 2, 4);
      m.release(80);

      const r1 = m.tick(120, treeBounds, insideCenter);
      const center2 = { x: insideCenter.x + r1.dx, y: insideCenter.y + r1.dy };
      const r2 = m.tick(120, treeBounds, center2);
      const center3 = { x: center2.x + r2.dx, y: center2.y + r2.dy };
      const r3 = m.tick(120, treeBounds, center3);

      // r3 should be half of r2, which is half of r1
      expect(r3.dx).toBeCloseTo(r1.dx / 4, 5);
      expect(r3.dy).toBeCloseTo(r1.dy / 4, 5);
    });
  });

  describe('momentum stops when both axes below threshold', () => {
    it('reports done when both vx and vy decay below 0.001', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 0.01, 0.01);
      m.recordDrag(40, 0.01, 0.01);
      m.recordDrag(80, 0.01, 0.01);
      m.release(80);

      let done = false;
      let center = { ...insideCenter };
      let iterations = 0;
      while (!done && iterations < 1000) {
        const result = m.tick(120, treeBounds, center);
        center = { x: center.x + result.dx, y: center.y + result.dy };
        done = result.done;
        iterations++;
      }
      expect(done).toBe(true);
    });

    it('continues while one axis is still above threshold', () => {
      const m = new PanMomentum();
      // Large x velocity, very small y velocity
      m.recordDrag(0, 5, 0.0001);
      m.recordDrag(40, 5, 0.0001);
      m.recordDrag(80, 5, 0.0001);
      m.release(80);

      const result = m.tick(120, treeBounds, insideCenter);
      expect(result.done).toBe(false);
    });

    it('returns done=true on further ticks after momentum ends', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 0.01, 0.01);
      m.recordDrag(40, 0.01, 0.01);
      m.recordDrag(80, 0.01, 0.01);
      m.release(80);

      let done = false;
      let center = { ...insideCenter };
      while (!done) {
        const result = m.tick(120, treeBounds, center);
        center = { x: center.x + result.dx, y: center.y + result.dy };
        done = result.done;
      }
      // Further ticks should be done with zero displacement
      const after = m.tick(120, treeBounds, center);
      expect(after.done).toBe(true);
      expect(after.dx).toBe(0);
      expect(after.dy).toBe(0);
    });
  });

  describe('boundary damping — 80% speed reduction outside tree bounds', () => {
    it('reduces displacement by 80% when viewport center is outside tree bounds', () => {
      // Instance for inside-bounds tick
      const mInside = new PanMomentum();
      mInside.recordDrag(0, 1, 1);
      mInside.recordDrag(40, 1, 1);
      mInside.recordDrag(80, 1, 1);
      mInside.release(80);
      const rInside = mInside.tick(60, treeBounds, insideCenter);

      // Instance for outside-bounds tick (within visibility clamp range)
      const mOutside = new PanMomentum();
      mOutside.recordDrag(0, 1, 1);
      mOutside.recordDrag(40, 1, 1);
      mOutside.recordDrag(80, 1, 1);
      mOutside.release(80);
      const outsideCenter = { x: 110, y: 110 };
      const rOutside = mOutside.tick(60, treeBounds, outsideCenter);

      // Outside should be 20% of inside (80% reduction)
      expect(rOutside.dx).toBeCloseTo(rInside.dx * 0.2, 5);
      expect(rOutside.dy).toBeCloseTo(rInside.dy * 0.2, 5);
    });

    it('does not dampen when viewport center is inside tree bounds', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 1, 1);
      m.recordDrag(40, 1, 1);
      m.recordDrag(80, 1, 1);
      m.release(80);

      const result = m.tick(60, treeBounds, insideCenter);
      // Velocity should be totalDelta / timeSpan = 3/80 per axis
      expect(result.dx).not.toBe(0);
      expect(result.dy).not.toBe(0);
      expect(result.done).toBe(false);
    });
  });

  describe('snap-back animation — 200ms ease-out to nearest edge', () => {
    it('triggers snap-back when released outside bounds with no velocity', () => {
      const m = new PanMomentum();
      // Single drag event — not enough for momentum velocity
      m.recordDrag(0, 1, 1);
      m.release(0);

      const outsideCenter = { x: 150, y: 50 };
      const result = m.tick(16, treeBounds, outsideCenter);
      // Should be animating toward tree bounds (moving left toward x=100)
      expect(result.dx).toBeLessThan(0);
      expect(result.done).toBe(false);
    });

    it('completes snap-back within 200ms', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 0, 0);
      m.recordDrag(40, 0, 0);
      m.recordDrag(80, 0, 0);
      m.release(80);

      const outsideCenter = { x: 150, y: 50 };
      let center = { ...outsideCenter };
      let done = false;
      let totalTime = 0;

      while (!done && totalTime < 1000) {
        const result = m.tick(16, treeBounds, center);
        center = { x: center.x + result.dx, y: center.y + result.dy };
        done = result.done;
        totalTime += 16;
      }

      expect(done).toBe(true);
      // Should complete in approximately 200ms (with 16ms steps, 13 steps = 208ms)
      expect(totalTime).toBeLessThanOrEqual(224);
      // Should have snapped to nearest x edge (100 = right edge of tree bounds)
      expect(center.x).toBeCloseTo(100, 0);
      // y was inside bounds, so unchanged
      expect(center.y).toBeCloseTo(50, 0);
    });

    it('snaps to nearest edge in both axes', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 0, 0);
      m.recordDrag(40, 0, 0);
      m.recordDrag(80, 0, 0);
      m.release(80);

      const outsideCenter = { x: 150, y: -30 };
      let center = { ...outsideCenter };
      let done = false;

      while (!done) {
        const result = m.tick(16, treeBounds, center);
        center = { x: center.x + result.dx, y: center.y + result.dy };
        done = result.done;
      }

      expect(center.x).toBeCloseTo(100, 0); // Nearest x edge: right
      expect(center.y).toBeCloseTo(0, 0);   // Nearest y edge: top
    });

    it('triggers snap-back after momentum ends outside bounds', () => {
      const m = new PanMomentum();
      // Moderate velocity pushing outward
      m.recordDrag(0, 5, 0);
      m.recordDrag(40, 5, 0);
      m.recordDrag(80, 5, 0);
      m.release(80);

      // Start near the right edge but inside bounds
      let center = { x: 95, y: 50 };
      let done = false;
      let totalSteps = 0;

      while (!done && totalSteps < 500) {
        const result = m.tick(16, treeBounds, center);
        center = { x: center.x + result.dx, y: center.y + result.dy };
        done = result.done;
        totalSteps++;
      }

      expect(done).toBe(true);
      // After momentum + snap-back, should be at the tree bounds edge
      expect(center.x).toBeCloseTo(100, 0);
    });

    it('uses ease-out curve for snap-back', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 0, 0);
      m.recordDrag(40, 0, 0);
      m.recordDrag(80, 0, 0);
      m.release(80);

      const outsideCenter = { x: 200, y: 50 };
      let center = { ...outsideCenter };

      // First 50ms: should move a significant fraction (ease-out starts fast)
      const r1 = m.tick(50, treeBounds, center);
      center = { x: center.x + r1.dx, y: center.y + r1.dy };

      // Next 50ms: should move less (ease-out decelerates)
      const r2 = m.tick(50, treeBounds, center);

      // Ease-out: first half covers more distance than second half
      expect(Math.abs(r1.dx)).toBeGreaterThan(Math.abs(r2.dx));
    });
  });

  describe('20% visibility — viewport cannot fully leave bounds', () => {
    it('clamps displacement so at least 20% of tree remains visible', () => {
      const m = new PanMomentum();
      // Very high velocity pushing far away
      m.recordDrag(0, 500, 500);
      m.recordDrag(40, 500, 500);
      m.recordDrag(80, 500, 500);
      m.release(80);

      // Already far from bounds
      const farCenter = { x: 500, y: 500 };
      const result = m.tick(16, treeBounds, farCenter);

      // After applying displacement, should not exceed max allowed distance
      const newX = farCenter.x + result.dx;
      const newY = farCenter.y + result.dy;

      // Max distance: tree bounds edge + 80% of tree dimension
      const maxX = treeBounds.x + treeBounds.width + 0.8 * treeBounds.width;
      const maxY = treeBounds.y + treeBounds.height + 0.8 * treeBounds.height;
      expect(newX).toBeLessThanOrEqual(maxX + 0.001);
      expect(newY).toBeLessThanOrEqual(maxY + 0.001);
    });

    it('clamps in negative direction too', () => {
      const m = new PanMomentum();
      m.recordDrag(0, -500, -500);
      m.recordDrag(40, -500, -500);
      m.recordDrag(80, -500, -500);
      m.release(80);

      const farCenter = { x: -500, y: -500 };
      const result = m.tick(16, treeBounds, farCenter);

      const newX = farCenter.x + result.dx;
      const newY = farCenter.y + result.dy;

      const minX = treeBounds.x - 0.8 * treeBounds.width;
      const minY = treeBounds.y - 0.8 * treeBounds.height;
      expect(newX).toBeGreaterThanOrEqual(minX - 0.001);
      expect(newY).toBeGreaterThanOrEqual(minY - 0.001);
    });
  });

  describe('velocity tracking', () => {
    it('requires 3 events within 150ms window for momentum', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 1, 1);
      m.recordDrag(50, 1, 1);
      const v = m.release(50);
      expect(v.vx).toBe(0);
      expect(v.vy).toBe(0);
    });

    it('single drag event produces zero release velocity', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 1, 1);
      const v = m.release(0);
      expect(v.vx).toBe(0);
      expect(v.vy).toBe(0);
    });

    it('excludes events older than 150ms', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 5, 5);
      m.recordDrag(200, 1, 1);
      m.recordDrag(250, 1, 1);
      const v = m.release(250);
      // Only 2 events within 150ms window — not enough
      expect(v.vx).toBe(0);
      expect(v.vy).toBe(0);
    });

    it('computes velocity from recent drag events', () => {
      const m = new PanMomentum();
      m.recordDrag(100, 3, 6);
      m.recordDrag(140, 3, 6);
      m.recordDrag(180, 3, 6);
      const v = m.release(180);
      // totalDx = 9, totalDy = 18, timeSpan = 80ms
      expect(v.vx).toBeCloseTo(9 / 80, 8);
      expect(v.vy).toBeCloseTo(18 / 80, 8);
    });

    it('only keeps last 3 drag events', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 10, 10);  // will be dropped
      m.recordDrag(30, 1, 2);
      m.recordDrag(60, 1, 2);
      m.recordDrag(90, 1, 2);
      const v = m.release(90);
      // Last 3: totalDx = 3, totalDy = 6, timeSpan = 60ms
      expect(v.vx).toBeCloseTo(3 / 60, 8);
      expect(v.vy).toBeCloseTo(6 / 60, 8);
    });

    it('preserves sign for negative drags', () => {
      const m = new PanMomentum();
      m.recordDrag(0, -1, -2);
      m.recordDrag(40, -1, -2);
      m.recordDrag(80, -1, -2);
      const v = m.release(80);
      expect(v.vx).toBeLessThan(0);
      expect(v.vy).toBeLessThan(0);
    });

    it('returns zero for events at same timestamp (zero timeSpan)', () => {
      const m = new PanMomentum();
      m.recordDrag(100, 1, 1);
      m.recordDrag(100, 1, 1);
      m.recordDrag(100, 1, 1);
      const v = m.release(100);
      expect(v.vx).toBe(0);
      expect(v.vy).toBe(0);
    });
  });

  describe('interruption', () => {
    it('cancels active momentum on interrupt()', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 1, 1);
      m.recordDrag(40, 1, 1);
      m.recordDrag(80, 1, 1);
      m.release(80);

      // Momentum is active
      const before = m.tick(60, treeBounds, insideCenter);
      expect(before.done).toBe(false);

      m.interrupt();

      const after = m.tick(60, treeBounds, insideCenter);
      expect(after.dx).toBe(0);
      expect(after.dy).toBe(0);
      expect(after.done).toBe(true);
    });

    it('new recordDrag cancels active momentum', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 1, 1);
      m.recordDrag(40, 1, 1);
      m.recordDrag(80, 1, 1);
      m.release(80);

      const before = m.tick(60, treeBounds, insideCenter);
      expect(before.done).toBe(false);

      m.recordDrag(200, 0.5, 0.5);

      const after = m.tick(60, treeBounds, insideCenter);
      expect(after.dx).toBe(0);
      expect(after.dy).toBe(0);
      expect(after.done).toBe(true);
    });

    it('cancels snap-back on interrupt()', () => {
      const m = new PanMomentum();
      m.recordDrag(0, 0, 0);
      m.recordDrag(40, 0, 0);
      m.recordDrag(80, 0, 0);
      m.release(80);

      const outsideCenter = { x: 150, y: 50 };
      // Start snap-back
      const r = m.tick(16, treeBounds, outsideCenter);
      expect(r.done).toBe(false);

      m.interrupt();

      const after = m.tick(16, treeBounds, outsideCenter);
      expect(after.dx).toBe(0);
      expect(after.dy).toBe(0);
      expect(after.done).toBe(true);
    });
  });

  describe('tick with negative velocity applies friction correctly', () => {
    it('produces negative displacement for negative velocity', () => {
      const m = new PanMomentum();
      m.recordDrag(0, -1, -2);
      m.recordDrag(40, -1, -2);
      m.recordDrag(80, -1, -2);
      m.release(80);

      const result = m.tick(120, treeBounds, insideCenter);
      expect(result.dx).toBeLessThan(0);
      expect(result.dy).toBeLessThan(0);
      expect(result.done).toBe(false);
    });
  });

  describe('non-trivial initial state', () => {
    it('uses non-zero initial center and non-identity velocities', () => {
      const m = new PanMomentum();
      // Non-trivial velocities
      m.recordDrag(0, 3, 7);
      m.recordDrag(40, 3, 7);
      m.recordDrag(80, 3, 7);
      m.release(80);

      // Non-zero initial center
      const center = { x: 30, y: 40 };
      const r1 = m.tick(120, treeBounds, center);

      // Velocity = 9/80 in x, 21/80 in y
      // After 120ms friction: velocity halves
      // Displacement = (v + v*0.5)/2 * 120 = v * 0.75 * 120
      const vx = 9 / 80;
      const vy = 21 / 80;
      const expectedDx = ((vx + vx * 0.5) / 2) * 120;
      const expectedDy = ((vy + vy * 0.5) / 2) * 120;
      expect(r1.dx).toBeCloseTo(expectedDx, 5);
      expect(r1.dy).toBeCloseTo(expectedDy, 5);
    });
  });
});
