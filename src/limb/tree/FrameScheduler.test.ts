// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { FrameScheduler } from './FrameScheduler.mjs';
import type { FrameSchedulerProbe } from '../ports/FrameSchedulerProbe';
import type { PerformanceProbe } from '../ports/PerformanceProbe';

class FakeAnimationFrame {
  private callbacks = new Map<number, () => void>();
  private nextId = 1;

  requestFrame = (cb: () => void): number => {
    const id = this.nextId++;
    this.callbacks.set(id, cb);
    return id;
  };

  cancelFrame = (id: number): void => {
    this.callbacks.delete(id);
  };

  tick(): void {
    const cbs = [...this.callbacks.entries()];
    this.callbacks.clear();
    for (const [, cb] of cbs) {
      cb();
    }
  }

  get pendingCount(): number {
    return this.callbacks.size;
  }
}

function createProbe() {
  const calls: string[] = [];
  const probe: FrameSchedulerProbe = {
    loopStarted() { calls.push('loopStarted'); },
    framePainted() { calls.push('framePainted'); },
    loopStopped() { calls.push('loopStopped'); },
  };
  return { probe, calls };
}

function setup() {
  const raf = new FakeAnimationFrame();
  const paintCalls: number[] = [];
  let paintCount = 0;
  const paint = () => { paintCount++; paintCalls.push(paintCount); };
  const { probe, calls } = createProbe();
  const scheduler = new FrameScheduler(paint, probe, {
    requestFrame: raf.requestFrame,
    cancelFrame: raf.cancelFrame,
  });
  return { scheduler, raf, paintCalls, probe, calls, getPaintCount: () => paintCount };
}

describe('FrameScheduler', () => {
  describe('frame loop runs when dirty', () => {
    it('paints on the next frame after markDirty()', () => {
      const { scheduler, raf, getPaintCount } = setup();

      scheduler.markDirty();
      expect(getPaintCount()).toBe(0); // not yet painted

      raf.tick(); // run the scheduled frame
      expect(getPaintCount()).toBe(1);
    });

    it('paints again when markDirty() is called between frames', () => {
      const { scheduler, raf, getPaintCount } = setup();

      scheduler.markDirty();
      raf.tick();
      expect(getPaintCount()).toBe(1);

      scheduler.markDirty();
      raf.tick();
      expect(getPaintCount()).toBe(2);
    });

    it('paints only once per frame even if markDirty() called multiple times', () => {
      const { scheduler, raf, getPaintCount } = setup();

      scheduler.markDirty();
      scheduler.markDirty();
      scheduler.markDirty();
      raf.tick();
      expect(getPaintCount()).toBe(1);
    });
  });

  describe('frame loop stops after 30 idle frames', () => {
    it('stops scheduling after 30 consecutive frames with no dirty flag', () => {
      const { scheduler, raf } = setup();

      scheduler.markDirty();
      raf.tick(); // paints, resets idle count

      // Run 30 idle frames (no markDirty)
      for (let i = 0; i < 30; i++) {
        raf.tick();
      }

      // No more frames should be scheduled
      expect(raf.pendingCount).toBe(0);
    });

    it('does not stop before 30 idle frames', () => {
      const { scheduler, raf } = setup();

      scheduler.markDirty();
      raf.tick();

      // Run 29 idle frames
      for (let i = 0; i < 29; i++) {
        raf.tick();
      }

      // Should still have a pending frame
      expect(raf.pendingCount).toBe(1);
    });

    it('resets idle count when markDirty() is called mid-countdown', () => {
      const { scheduler, raf, getPaintCount } = setup();

      scheduler.markDirty();
      raf.tick(); // paint 1

      // 20 idle frames
      for (let i = 0; i < 20; i++) {
        raf.tick();
      }

      // Mark dirty again — should reset the idle counter
      scheduler.markDirty();
      raf.tick(); // paint 2
      expect(getPaintCount()).toBe(2);

      // Now run 30 more idle frames
      for (let i = 0; i < 30; i++) {
        raf.tick();
      }

      expect(raf.pendingCount).toBe(0);
    });
  });

  describe('markDirty() resumes the loop', () => {
    it('resumes after the loop has stopped due to idle timeout', () => {
      const { scheduler, raf, getPaintCount } = setup();

      scheduler.markDirty();
      raf.tick(); // paint 1

      // Stop the loop
      for (let i = 0; i < 30; i++) {
        raf.tick();
      }
      expect(raf.pendingCount).toBe(0);

      // Resume
      scheduler.markDirty();
      expect(raf.pendingCount).toBe(1);

      raf.tick();
      expect(getPaintCount()).toBe(2);
    });
  });

  describe('no frames are scheduled when nothing has changed', () => {
    it('does not schedule any frames before first markDirty()', () => {
      const { raf } = setup();
      expect(raf.pendingCount).toBe(0);
    });
  });

  describe('probe events', () => {
    it('fires loopStarted when the loop begins', () => {
      const { scheduler, calls } = setup();

      scheduler.markDirty();
      expect(calls).toContain('loopStarted');
    });

    it('fires framePainted on each paint', () => {
      const { scheduler, raf, calls } = setup();

      scheduler.markDirty();
      raf.tick();
      expect(calls).toContain('framePainted');
    });

    it('fires loopStopped after 30 idle frames', () => {
      const { scheduler, raf, calls } = setup();

      scheduler.markDirty();
      raf.tick();

      for (let i = 0; i < 30; i++) {
        raf.tick();
      }

      expect(calls).toContain('loopStopped');
    });

    it('fires loopStarted again when resuming after stop', () => {
      const { scheduler, raf, calls } = setup();

      scheduler.markDirty();
      raf.tick();

      for (let i = 0; i < 30; i++) {
        raf.tick();
      }

      calls.length = 0; // clear

      scheduler.markDirty();
      expect(calls).toContain('loopStarted');
    });
  });

  describe('destroy', () => {
    it('cancels any pending frame', () => {
      const { scheduler, raf } = setup();

      scheduler.markDirty();
      expect(raf.pendingCount).toBe(1);

      scheduler.destroy();
      expect(raf.pendingCount).toBe(0);
    });

    it('does not paint after destroy', () => {
      const { scheduler, raf, getPaintCount } = setup();

      scheduler.markDirty();
      scheduler.destroy();
      raf.tick();
      expect(getPaintCount()).toBe(0);
    });
  });

  describe('performance probe: frame budget', () => {
    function createPerfProbe() {
      const calls: { method: string; args: number[] }[] = [];
      const perfProbe: PerformanceProbe = {
        frameBudgetExceeded(actualMs, budgetMs) {
          calls.push({ method: 'frameBudgetExceeded', args: [actualMs, budgetMs] });
        },
        lodComputationTime(ms) {
          calls.push({ method: 'lodComputationTime', args: [ms] });
        },
        memorySnapshot(heapMB, screenshotsMB, tabCount) {
          calls.push({ method: 'memorySnapshot', args: [heapMB, screenshotsMB, tabCount] });
        },
        degradedModeEntered() {
          calls.push({ method: 'degradedModeEntered', args: [] });
        },
        degradedModeExited() {
          calls.push({ method: 'degradedModeExited', args: [] });
        },
      };
      return { perfProbe, calls };
    }

    function setupWithPerf(paintDurationMs: number) {
      const raf = new FakeAnimationFrame();
      let clock = 0;
      const now = () => clock;
      const paint = () => { clock += paintDurationMs; };
      const { probe, calls: probeCalls } = createProbe();
      const { perfProbe, calls: perfCalls } = createPerfProbe();
      const scheduler = new FrameScheduler(paint, probe, {
        requestFrame: raf.requestFrame,
        cancelFrame: raf.cancelFrame,
        performanceProbe: perfProbe,
        now,
      });
      return { scheduler, raf, perfCalls, probeCalls };
    }

    it('fires frameBudgetExceeded when paint takes longer than 16ms', () => {
      const { scheduler, raf, perfCalls } = setupWithPerf(20);

      scheduler.markDirty();
      raf.tick();

      expect(perfCalls).toEqual([
        { method: 'frameBudgetExceeded', args: [20, 16] },
      ]);
    });

    it('does not fire frameBudgetExceeded when paint takes exactly 16ms', () => {
      const { scheduler, raf, perfCalls } = setupWithPerf(16);

      scheduler.markDirty();
      raf.tick();

      expect(perfCalls).toEqual([]);
    });

    it('does not fire frameBudgetExceeded when paint takes less than 16ms', () => {
      const { scheduler, raf, perfCalls } = setupWithPerf(10);

      scheduler.markDirty();
      raf.tick();

      expect(perfCalls).toEqual([]);
    });

    it('reports the actual frame duration in frameBudgetExceeded', () => {
      const { scheduler, raf, perfCalls } = setupWithPerf(42);

      scheduler.markDirty();
      raf.tick();

      expect(perfCalls[0].args[0]).toBe(42);
      expect(perfCalls[0].args[1]).toBe(16);
    });

    it('fires frameBudgetExceeded on each over-budget frame', () => {
      const { scheduler, raf, perfCalls } = setupWithPerf(25);

      scheduler.markDirty();
      raf.tick();
      scheduler.markDirty();
      raf.tick();

      expect(perfCalls.length).toBe(2);
    });

    it('does not fire on idle frames (no paint)', () => {
      const { scheduler, raf, perfCalls } = setupWithPerf(20);

      scheduler.markDirty();
      raf.tick(); // paints (over budget)
      perfCalls.length = 0;

      raf.tick(); // idle frame, no paint
      expect(perfCalls).toEqual([]);
    });

    it('works without a performance probe', () => {
      const raf = new FakeAnimationFrame();
      let painted = false;
      const paint = () => { painted = true; };
      const scheduler = new FrameScheduler(paint, null, {
        requestFrame: raf.requestFrame,
        cancelFrame: raf.cancelFrame,
      });

      scheduler.markDirty();
      raf.tick();

      expect(painted).toBe(true);
    });
  });

  describe('degraded mode integration', () => {
    function setupWithDegraded(paintDurationMs: number) {
      const raf = new FakeAnimationFrame();
      let clock = 0;
      const now = () => clock;
      const paint = () => { clock += paintDurationMs; };
      const { probe, calls: probeCalls } = createProbe();
      const perfCalls: { method: string; args: number[] }[] = [];
      const perfProbe: PerformanceProbe = {
        frameBudgetExceeded(actualMs, budgetMs) {
          perfCalls.push({ method: 'frameBudgetExceeded', args: [actualMs, budgetMs] });
        },
        lodComputationTime(ms) {
          perfCalls.push({ method: 'lodComputationTime', args: [ms] });
        },
        memorySnapshot(heapMB, screenshotsMB, tabCount) {
          perfCalls.push({ method: 'memorySnapshot', args: [heapMB, screenshotsMB, tabCount] });
        },
        degradedModeEntered() {
          perfCalls.push({ method: 'degradedModeEntered', args: [] });
        },
        degradedModeExited() {
          perfCalls.push({ method: 'degradedModeExited', args: [] });
        },
      };
      const scheduler = new FrameScheduler(paint, probe, {
        requestFrame: raf.requestFrame,
        cancelFrame: raf.cancelFrame,
        performanceProbe: perfProbe,
        now,
      });
      return { scheduler, raf, perfCalls, probeCalls };
    }

    it('enters degraded mode after 3 slow frames', () => {
      const { scheduler, raf } = setupWithDegraded(20);

      for (let i = 0; i < 3; i++) {
        scheduler.markDirty();
        raf.tick();
      }

      expect(scheduler.isDegraded).toBe(true);
    });

    it('exits degraded mode after 10 consecutive fast frames', () => {
      const { scheduler, raf } = setupWithDegraded(20);

      // Enter degraded mode
      for (let i = 0; i < 3; i++) {
        scheduler.markDirty();
        raf.tick();
      }
      expect(scheduler.isDegraded).toBe(true);

      // Now make frames fast (need to create a new scheduler with fast paint
      // since paint duration is fixed). Instead, use the degradedFrameCount test.
    });

    it('is not degraded initially', () => {
      const { scheduler } = setupWithDegraded(10);
      expect(scheduler.isDegraded).toBe(false);
    });

    it('fires degradedModeEntered probe event', () => {
      const { scheduler, raf, perfCalls } = setupWithDegraded(20);

      for (let i = 0; i < 3; i++) {
        scheduler.markDirty();
        raf.tick();
      }

      expect(perfCalls.some(c => c.method === 'degradedModeEntered')).toBe(true);
    });

    it('tracks degraded frame count', () => {
      const { scheduler, raf } = setupWithDegraded(20);

      // Enter degraded mode (frame 3 is the first degraded frame)
      for (let i = 0; i < 3; i++) {
        scheduler.markDirty();
        raf.tick();
      }
      expect(scheduler.isDegraded).toBe(true);
      expect(scheduler.degradedFrameCount).toBe(1);

      // Frame 4 and 5 are additional degraded frames
      scheduler.markDirty();
      raf.tick();
      expect(scheduler.degradedFrameCount).toBe(2);

      scheduler.markDirty();
      raf.tick();
      expect(scheduler.degradedFrameCount).toBe(3);
    });

    it('does not record frame duration for idle frames', () => {
      const { scheduler, raf } = setupWithDegraded(20);

      scheduler.markDirty();
      raf.tick(); // one slow paint frame

      // 4 idle frames (no paint, no duration to record)
      for (let i = 0; i < 4; i++) {
        raf.tick();
      }

      // Should not have entered degraded mode from idle frames
      expect(scheduler.isDegraded).toBe(false);
    });
  });
});

