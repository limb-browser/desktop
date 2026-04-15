// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { DegradedModeController } from './DegradedModeController.mjs';
import type { PerformanceProbe } from '../ports/PerformanceProbe';

function createProbe() {
  const calls: string[] = [];
  const probe: PerformanceProbe = {
    frameBudgetExceeded() {},
    lodComputationTime() {},
    memorySnapshot() {},
    degradedModeEntered() { calls.push('degradedModeEntered'); },
    degradedModeExited() { calls.push('degradedModeExited'); },
  };
  return { probe, calls };
}

describe('DegradedModeController', () => {
  describe('degraded mode activates after consecutive slow frames', () => {
    it('enters degraded mode when 3 of the last 5 frames exceed 16ms', () => {
      const { probe, calls } = createProbe();
      const controller = new DegradedModeController(probe);

      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);

      expect(controller.isDegraded).toBe(true);
      expect(calls).toContain('degradedModeEntered');
    });

    it('does not enter degraded mode with only 2 of 5 slow frames', () => {
      const { probe, calls } = createProbe();
      const controller = new DegradedModeController(probe);

      controller.recordFrameDuration(20);
      controller.recordFrameDuration(10);
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(10);
      controller.recordFrameDuration(10);

      expect(controller.isDegraded).toBe(false);
      expect(calls).not.toContain('degradedModeEntered');
    });

    it('uses a rolling window of 5 frames', () => {
      const { probe, calls } = createProbe();
      const controller = new DegradedModeController(probe);

      // 3 slow frames triggers
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(10);
      controller.recordFrameDuration(10);
      controller.recordFrameDuration(20);

      expect(controller.isDegraded).toBe(true);
      expect(calls).toContain('degradedModeEntered');
    });

    it('triggers based on strictly exceeding 16ms', () => {
      const { probe } = createProbe();
      const controller = new DegradedModeController(probe);

      // 16ms exactly should NOT count as exceeding
      controller.recordFrameDuration(16);
      controller.recordFrameDuration(16);
      controller.recordFrameDuration(16);

      expect(controller.isDegraded).toBe(false);
    });

    it('fires degradedModeEntered only once on entry', () => {
      const { probe, calls } = createProbe();
      const controller = new DegradedModeController(probe);

      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);
      // Already degraded, further slow frames should not re-fire
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);

      expect(calls.filter(c => c === 'degradedModeEntered').length).toBe(1);
    });
  });

  describe('degraded mode deactivates after consecutive fast frames', () => {
    it('exits degraded mode after 10 consecutive frames under 12ms', () => {
      const { probe, calls } = createProbe();
      const controller = new DegradedModeController(probe);

      // Enter degraded mode
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);
      expect(controller.isDegraded).toBe(true);

      // 10 fast frames
      for (let i = 0; i < 10; i++) {
        controller.recordFrameDuration(8);
      }

      expect(controller.isDegraded).toBe(false);
      expect(calls).toContain('degradedModeExited');
    });

    it('does not exit after only 9 consecutive fast frames', () => {
      const { probe, calls } = createProbe();
      const controller = new DegradedModeController(probe);

      // Enter degraded mode
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);

      // 9 fast frames
      for (let i = 0; i < 9; i++) {
        controller.recordFrameDuration(8);
      }

      expect(controller.isDegraded).toBe(true);
      expect(calls).not.toContain('degradedModeExited');
    });

    it('resets fast-frame counter when a frame reaches 12ms or more', () => {
      const { probe } = createProbe();
      const controller = new DegradedModeController(probe);

      // Enter degraded mode
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);

      // 5 fast frames, then one at 12ms, then 5 more fast
      for (let i = 0; i < 5; i++) {
        controller.recordFrameDuration(8);
      }
      controller.recordFrameDuration(12); // exactly 12ms resets counter
      for (let i = 0; i < 5; i++) {
        controller.recordFrameDuration(8);
      }

      expect(controller.isDegraded).toBe(true);
    });

    it('exits when 10 consecutive frames are strictly under 12ms', () => {
      const { probe } = createProbe();
      const controller = new DegradedModeController(probe);

      // Enter degraded mode
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);

      // 11.9ms should count as under 12ms
      for (let i = 0; i < 10; i++) {
        controller.recordFrameDuration(11.9);
      }

      expect(controller.isDegraded).toBe(false);
    });

    it('fires degradedModeExited only once on exit', () => {
      const { probe, calls } = createProbe();
      const controller = new DegradedModeController(probe);

      // Enter degraded mode
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);

      // Exit degraded mode
      for (let i = 0; i < 10; i++) {
        controller.recordFrameDuration(8);
      }

      // More fast frames should not re-fire
      for (let i = 0; i < 10; i++) {
        controller.recordFrameDuration(8);
      }

      expect(calls.filter(c => c === 'degradedModeExited').length).toBe(1);
    });
  });

  describe('re-entry after exit', () => {
    it('can re-enter degraded mode after exiting', () => {
      const { probe, calls } = createProbe();
      const controller = new DegradedModeController(probe);

      // Enter
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);
      expect(controller.isDegraded).toBe(true);

      // Exit
      for (let i = 0; i < 10; i++) {
        controller.recordFrameDuration(8);
      }
      expect(controller.isDegraded).toBe(false);

      // Re-enter
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);
      expect(controller.isDegraded).toBe(true);

      expect(calls.filter(c => c === 'degradedModeEntered').length).toBe(2);
      expect(calls.filter(c => c === 'degradedModeExited').length).toBe(1);
    });
  });

  describe('starts in non-degraded state', () => {
    it('is not degraded initially', () => {
      const { probe } = createProbe();
      const controller = new DegradedModeController(probe);
      expect(controller.isDegraded).toBe(false);
    });
  });

  describe('works without a probe', () => {
    it('functions correctly without a probe', () => {
      const controller = new DegradedModeController();

      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);
      controller.recordFrameDuration(20);

      expect(controller.isDegraded).toBe(true);

      for (let i = 0; i < 10; i++) {
        controller.recordFrameDuration(8);
      }

      expect(controller.isDegraded).toBe(false);
    });
  });
});
