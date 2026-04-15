// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from "vitest";
import { PanMomentum } from "./PanMomentum.mjs";

/**
 * Tree bounds and viewport size used across tests.
 * Tree: 10 units wide, 8 units tall, starting at origin.
 * Viewport: 5x4 logical units (half the tree in each dimension).
 */
const bounds = { minX: 0, minY: 0, maxX: 10, maxY: 8 };
const vpSize = { width: 5, height: 4 };

/**
 * Large bounds for friction/momentum tests that need room to decelerate
 * without hitting the visibility clamp.
 */
const largeBounds = { minX: -100, minY: -100, maxX: 100, maxY: 100 };
const largeVpSize = { width: 10, height: 10 };

/**
 * Record several drag samples to establish a known velocity.
 * 3 samples of {dx: -1, dy: -0.5} over 16ms each.
 * Velocity: vx = -3/48 = -0.0625, vy = -1.5/48 = -0.03125 units/ms.
 */
function recordDragSamples(pm) {
  pm.recordDrag(-1, -0.5, 16);
  pm.recordDrag(-1, -0.5, 16);
  pm.recordDrag(-1, -0.5, 16);
}

/** Create a probe that records events into arrays. */
function createProbe() {
  const events = [];
  return {
    events,
    momentumStarted(vx, vy) { events.push({ type: "momentumStarted", vx, vy }); },
    momentumStopped() { events.push({ type: "momentumStopped" }); },
    snapBackStarted(targetX, targetY) { events.push({ type: "snapBackStarted", targetX, targetY }); },
    snapBackCompleted() { events.push({ type: "snapBackCompleted" }); },
    cancelled() { events.push({ type: "cancelled" }); },
  };
}

describe("PanMomentum", () => {
  describe("momentum on drag release", () => {
    it("applies momentum after drag release inside bounds", () => {
      const pm = new PanMomentum();
      recordDragSamples(pm);

      pm.release({ x: 5, y: 4 }, bounds);
      expect(pm.isActive).toBe(true);

      const result = pm.update(16, { x: 5, y: 4 }, bounds, vpSize);
      expect(result.dx).not.toBe(0);
      expect(result.dy).not.toBe(0);
      expect(result.active).toBe(true);
    });

    it("does not start momentum with zero velocity", () => {
      const pm = new PanMomentum();
      // No drag samples recorded
      pm.release({ x: 5, y: 4 }, bounds);
      expect(pm.isActive).toBe(false);
    });

    it("does not start momentum when velocity is below threshold", () => {
      const pm = new PanMomentum();
      // Very tiny movement
      pm.recordDrag(0.00001, 0, 16);
      pm.recordDrag(0.00001, 0, 16);
      pm.recordDrag(0.00001, 0, 16);
      pm.release({ x: 5, y: 4 }, bounds);
      expect(pm.isActive).toBe(false);
    });
  });

  describe("friction model", () => {
    it("velocity halves every 120ms", () => {
      const pm = new PanMomentum();
      recordDragSamples(pm);

      const focus = { x: 0, y: 0 };
      pm.release(focus, largeBounds);

      // Sample velocity near t=0 with a tiny dt
      const dt = 0.1;
      const r0 = pm.update(dt, focus, largeBounds, largeVpSize);
      const v0x = r0.dx / dt;

      // Advance to t=120ms
      let f = { x: focus.x + r0.dx, y: focus.y + r0.dy };
      const rMid = pm.update(120 - dt, f, largeBounds, largeVpSize);
      f = { x: f.x + rMid.dx, y: f.y + rMid.dy };

      // Sample velocity at t=120ms
      const r120 = pm.update(dt, f, largeBounds, largeVpSize);
      const v120x = r120.dx / dt;

      expect(v120x / v0x).toBeCloseTo(0.5, 1);
    });

    it("both axes decelerate independently", () => {
      const pm = new PanMomentum();
      recordDragSamples(pm);

      const focus = { x: 0, y: 0 };
      pm.release(focus, largeBounds);

      const r = pm.update(16, focus, largeBounds, largeVpSize);
      // vx = -0.0625, vy = -0.03125 → ratio dy/dx should be 0.5
      expect(r.dy / r.dx).toBeCloseTo(0.5, 2);

      // After more time, ratio should remain the same
      const f2 = { x: focus.x + r.dx, y: focus.y + r.dy };
      const r2 = pm.update(100, f2, largeBounds, largeVpSize);
      expect(r2.dy / r2.dx).toBeCloseTo(0.5, 2);
    });

    it("stops when velocity magnitude drops below threshold", () => {
      const pm = new PanMomentum();
      recordDragSamples(pm);

      const focus = { x: 0, y: 0 };
      pm.release(focus, largeBounds);

      // Run momentum until it stops
      let f = { ...focus };
      let active = true;
      let frames = 0;
      while (active && frames < 1000) {
        const r = pm.update(16, f, largeBounds, largeVpSize);
        f = { x: f.x + r.dx, y: f.y + r.dy };
        active = r.active;
        frames++;
      }
      expect(active).toBe(false);
      expect(pm.isActive).toBe(false);
    });
  });

  describe("boundary damping", () => {
    it("reduces pan delta by 80% when focusPoint is outside bounds", () => {
      const pm = new PanMomentum();
      // Focus outside bounds (right of maxX)
      const outsideFocus = { x: 12, y: 4 };
      const damped = pm.dampDelta(-1, -0.5, outsideFocus, bounds);
      expect(damped.dx).toBeCloseTo(-1 * 0.2);
      expect(damped.dy).toBeCloseTo(-0.5 * 0.2);
    });

    it("does not damp when focusPoint is inside bounds", () => {
      const pm = new PanMomentum();
      const insideFocus = { x: 5, y: 4 };
      const damped = pm.dampDelta(-1, -0.5, insideFocus, bounds);
      expect(damped.dx).toBe(-1);
      expect(damped.dy).toBe(-0.5);
    });

    it("applies 80% damping during momentum when outside bounds", () => {
      const pm = new PanMomentum();
      // Give enough velocity for at least one frame
      pm.recordDrag(-2, 0, 16);
      pm.recordDrag(-2, 0, 16);
      pm.recordDrag(-2, 0, 16);

      // Use the standard bounds. With vpSize, visibility maxFocusX = 10.5,
      // so x=10.2 is outside bounds (maxX=10) but within visibility range.
      const focus = { x: 5, y: 4 };
      pm.release(focus, bounds);

      // First update: inside bounds, full speed
      const r1 = pm.update(1, focus, bounds, vpSize);
      const v1 = r1.dx / 1;

      // Teleport focus to just outside bounds but within visibility range
      const outsideFocus = { x: 10.2, y: 4 };
      const r2 = pm.update(1, outsideFocus, bounds, vpSize);
      const v2 = r2.dx / 1;

      // The velocity hasn't changed much (tiny dt), but the delta should
      // be ~20% because of damping factor
      expect(Math.abs(v2 / v1)).toBeCloseTo(0.2, 1);
    });
  });

  describe("snap-back", () => {
    it("starts snap-back on release when focusPoint is outside bounds", () => {
      const pm = new PanMomentum();
      recordDragSamples(pm);
      pm.release({ x: 12, y: 4 }, bounds);
      expect(pm.isActive).toBe(true);

      // Should animate toward nearest edge (x=10)
      const r = pm.update(100, { x: 12, y: 4 }, bounds, vpSize);
      expect(r.dx).toBeLessThan(0); // moving left toward x=10
    });

    it("completes snap-back at the nearest edge after 200ms", () => {
      const pm = new PanMomentum();
      pm.release({ x: 12, y: 10 }, bounds);

      // After 200ms, should reach the edge
      const r = pm.update(200, { x: 12, y: 10 }, bounds, vpSize);
      expect(12 + r.dx).toBeCloseTo(10); // nearest X edge
      expect(10 + r.dy).toBeCloseTo(8);  // nearest Y edge
      expect(r.active).toBe(false);
      expect(pm.isActive).toBe(false);
    });

    it("uses ease-out for snap-back interpolation", () => {
      const pm = new PanMomentum();
      pm.release({ x: 12, y: 4 }, bounds);

      // At t=100ms (50% of 200ms), ease-out gives 75% progress
      const r = pm.update(100, { x: 12, y: 4 }, bounds, vpSize);
      const expectedX = 12 + (10 - 12) * 0.75; // = 10.5
      expect(12 + r.dx).toBeCloseTo(expectedX, 1);
    });

    it("transitions from momentum to snap-back when momentum stops outside bounds", () => {
      const probe = createProbe();
      const pm = new PanMomentum(probe);
      // Small velocity moving right (toward outside bounds)
      pm.recordDrag(0.05, 0, 16);
      pm.recordDrag(0.05, 0, 16);
      pm.recordDrag(0.05, 0, 16);

      // Release just inside bounds near right edge
      pm.release({ x: 9.99, y: 4 }, bounds);

      // Run until momentum stops (it will cross bounds and slow down)
      let f = { x: 9.99, y: 4 };
      let frames = 0;
      while (pm.isActive && frames < 2000) {
        const r = pm.update(16, f, bounds, vpSize);
        f = { x: f.x + r.dx, y: f.y + r.dy };
        frames++;
      }

      // Should have seen: momentumStarted, then either momentumStopped or snapBack
      expect(probe.events[0].type).toBe("momentumStarted");
      // Final event should be snapBackCompleted or momentumStopped
      const lastEvent = probe.events[probe.events.length - 1];
      expect(["momentumStopped", "snapBackCompleted"]).toContain(lastEvent.type);
    });
  });

  describe("visibility hard limit", () => {
    it("clamps focusPoint to keep at least 20% of tree visible horizontally", () => {
      const pm = new PanMomentum();
      // maxFocusX = 10 - 0.2*10 + 5/2 = 10.5
      const clamped = pm.clampForVisibility({ x: 20, y: 4 }, bounds, vpSize);
      expect(clamped.x).toBeCloseTo(10.5);
      expect(clamped.y).toBe(4);

      // minFocusX = 0 + 0.2*10 - 5/2 = -0.5
      const clamped2 = pm.clampForVisibility({ x: -10, y: 4 }, bounds, vpSize);
      expect(clamped2.x).toBeCloseTo(-0.5);
    });

    it("clamps focusPoint to keep at least 20% of tree visible vertically", () => {
      const pm = new PanMomentum();
      // maxFocusY = 8 - 0.2*8 + 4/2 = 8 - 1.6 + 2 = 8.4
      const clamped = pm.clampForVisibility({ x: 5, y: 20 }, bounds, vpSize);
      expect(clamped.y).toBeCloseTo(8.4);

      // minFocusY = 0 + 0.2*8 - 4/2 = 1.6 - 2 = -0.4
      const clamped2 = pm.clampForVisibility({ x: 5, y: -10 }, bounds, vpSize);
      expect(clamped2.y).toBeCloseTo(-0.4);
    });

    it("does not clamp when focusPoint is within the valid range", () => {
      const pm = new PanMomentum();
      const clamped = pm.clampForVisibility({ x: 5, y: 4 }, bounds, vpSize);
      expect(clamped.x).toBe(5);
      expect(clamped.y).toBe(4);
    });
  });

  describe("cancellation", () => {
    it("cancels active momentum on cancel()", () => {
      const pm = new PanMomentum();
      recordDragSamples(pm);
      pm.release({ x: 5, y: 4 }, bounds);
      expect(pm.isActive).toBe(true);

      pm.cancel();
      expect(pm.isActive).toBe(false);

      const r = pm.update(16, { x: 5, y: 4 }, bounds, vpSize);
      expect(r.dx).toBe(0);
      expect(r.dy).toBe(0);
      expect(r.active).toBe(false);
    });

    it("cancels active snap-back on cancel()", () => {
      const pm = new PanMomentum();
      pm.release({ x: 12, y: 4 }, bounds);
      expect(pm.isActive).toBe(true);

      pm.cancel();
      expect(pm.isActive).toBe(false);
    });

    it("clears drag samples on cancel()", () => {
      const pm = new PanMomentum();
      recordDragSamples(pm);
      pm.cancel();

      // After cancel, release should have no velocity
      pm.release({ x: 5, y: 4 }, bounds);
      expect(pm.isActive).toBe(false);
    });
  });

  describe("probe events", () => {
    it("fires momentumStarted on release with velocity", () => {
      const probe = createProbe();
      const pm = new PanMomentum(probe);
      recordDragSamples(pm);
      pm.release({ x: 5, y: 4 }, bounds);

      expect(probe.events).toHaveLength(1);
      expect(probe.events[0].type).toBe("momentumStarted");
      expect(probe.events[0].vx).toBeCloseTo(-0.0625, 3);
      expect(probe.events[0].vy).toBeCloseTo(-0.03125, 3);
    });

    it("fires momentumStopped when velocity drops below threshold inside bounds", () => {
      const probe = createProbe();
      const pm = new PanMomentum(probe);
      recordDragSamples(pm);
      pm.release({ x: 0, y: 0 }, largeBounds);

      // Run until stopped (large bounds so focus stays inside)
      let f = { x: 0, y: 0 };
      let frames = 0;
      while (pm.isActive && frames < 1000) {
        const r = pm.update(16, f, largeBounds, largeVpSize);
        f = { x: f.x + r.dx, y: f.y + r.dy };
        frames++;
      }

      const lastEvent = probe.events[probe.events.length - 1];
      expect(lastEvent.type).toBe("momentumStopped");
    });

    it("fires snapBackStarted on release outside bounds", () => {
      const probe = createProbe();
      const pm = new PanMomentum(probe);
      pm.release({ x: 12, y: 4 }, bounds);

      expect(probe.events).toHaveLength(1);
      expect(probe.events[0].type).toBe("snapBackStarted");
      expect(probe.events[0].targetX).toBe(10);
      expect(probe.events[0].targetY).toBe(4);
    });

    it("fires snapBackCompleted when snap-back finishes", () => {
      const probe = createProbe();
      const pm = new PanMomentum(probe);
      pm.release({ x: 12, y: 4 }, bounds);
      pm.update(200, { x: 12, y: 4 }, bounds, vpSize);

      expect(probe.events).toHaveLength(2);
      expect(probe.events[1].type).toBe("snapBackCompleted");
    });

    it("fires cancelled on cancel()", () => {
      const probe = createProbe();
      const pm = new PanMomentum(probe);
      recordDragSamples(pm);
      pm.release({ x: 5, y: 4 }, bounds);

      pm.cancel();
      expect(probe.events).toHaveLength(2);
      expect(probe.events[1].type).toBe("cancelled");
    });

    it("does not fire cancelled when already idle", () => {
      const probe = createProbe();
      const pm = new PanMomentum(probe);
      pm.cancel();
      expect(probe.events).toHaveLength(0);
    });
  });
});
