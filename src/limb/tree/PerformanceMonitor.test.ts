// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { PerformanceMonitor } from './PerformanceMonitor.mjs';
import type { PerformanceProbe } from '../ports/PerformanceProbe';

function createPerfProbe() {
  const calls: { method: string; args: number[] }[] = [];
  const probe: PerformanceProbe = {
    frameBudgetExceeded(actualMs, budgetMs) {
      calls.push({ method: 'frameBudgetExceeded', args: [actualMs, budgetMs] });
    },
    lodComputationTime(ms) {
      calls.push({ method: 'lodComputationTime', args: [ms] });
    },
    memorySnapshot(heapMB, screenshotsMB, tabCount) {
      calls.push({ method: 'memorySnapshot', args: [heapMB, screenshotsMB, tabCount] });
    },
  };
  return { probe, calls };
}

class FakeTimer {
  private callbacks = new Map<number, { fn: () => void; intervalMs: number }>();
  private nextId = 1;

  setInterval = (fn: () => void, ms: number): number => {
    const id = this.nextId++;
    this.callbacks.set(id, { fn, intervalMs: ms });
    return id;
  };

  clearInterval = (id: number): void => {
    this.callbacks.delete(id);
  };

  async fire(id?: number): Promise<void> {
    if (id !== undefined) {
      const cb = this.callbacks.get(id);
      if (cb) await cb.fn();
    } else {
      for (const [, cb] of this.callbacks) {
        await cb.fn();
      }
    }
  }

  get activeCount(): number {
    return this.callbacks.size;
  }

  getIntervalMs(id: number): number | undefined {
    return this.callbacks.get(id)?.intervalMs;
  }

  get firstId(): number {
    return [...this.callbacks.keys()][0];
  }
}

function setup(snapshot?: { heapMB: number; screenshotsMB: number; tabCount: number }) {
  const timer = new FakeTimer();
  const { probe, calls } = createPerfProbe();
  const snapshotData = snapshot ?? { heapMB: 25.5, screenshotsMB: 15.2, tabCount: 5 };
  const getSnapshot = () => snapshotData;
  const monitor = new PerformanceMonitor(probe, getSnapshot, {
    setInterval: timer.setInterval,
    clearInterval: timer.clearInterval,
  });
  return { monitor, timer, calls, probe };
}

describe('PerformanceMonitor', () => {
  describe('periodic memory snapshots', () => {
    it('starts a 30-second interval on install', () => {
      const { monitor, timer } = setup();

      monitor.install();

      expect(timer.activeCount).toBe(1);
      expect(timer.getIntervalMs(timer.firstId)).toBe(30000);
    });

    it('fires memorySnapshot with correct data when interval triggers', async () => {
      const { monitor, timer, calls } = setup({ heapMB: 30.0, screenshotsMB: 10.5, tabCount: 8 });

      monitor.install();
      await timer.fire();

      expect(calls.length).toBe(1);
      expect(calls[0]).toEqual({
        method: 'memorySnapshot',
        args: [30.0, 10.5, 8],
      });
    });

    it('fires memorySnapshot on each interval tick', async () => {
      const { monitor, timer, calls } = setup();

      monitor.install();
      await timer.fire();
      await timer.fire();
      await timer.fire();

      expect(calls.length).toBe(3);
      expect(calls.every(c => c.method === 'memorySnapshot')).toBe(true);
    });

    it('uses latest snapshot data on each tick', async () => {
      const timer = new FakeTimer();
      const { probe, calls } = createPerfProbe();
      let tabCount = 3;
      const getSnapshot = () => ({ heapMB: 20, screenshotsMB: 10, tabCount });
      const monitor = new PerformanceMonitor(probe, getSnapshot, {
        setInterval: timer.setInterval,
        clearInterval: timer.clearInterval,
      });

      monitor.install();
      await timer.fire();
      tabCount = 7;
      await timer.fire();

      expect(calls[0].args[2]).toBe(3);
      expect(calls[1].args[2]).toBe(7);
    });
  });

  describe('async getSnapshot', () => {
    it('supports async getSnapshot returning a Promise', async () => {
      const timer = new FakeTimer();
      const { probe, calls } = createPerfProbe();
      const getSnapshot = async () => ({ heapMB: 42.0, screenshotsMB: 8.5, tabCount: 12 });
      const monitor = new PerformanceMonitor(probe, getSnapshot, {
        setInterval: timer.setInterval,
        clearInterval: timer.clearInterval,
      });

      monitor.install();
      await timer.fire();

      expect(calls.length).toBe(1);
      expect(calls[0]).toEqual({
        method: 'memorySnapshot',
        args: [42.0, 8.5, 12],
      });
    });
  });

  describe('uninstall stops the interval', () => {
    it('clears the interval on uninstall', () => {
      const { monitor, timer } = setup();

      monitor.install();
      expect(timer.activeCount).toBe(1);

      monitor.uninstall();
      expect(timer.activeCount).toBe(0);
    });

    it('does not fire after uninstall', async () => {
      const { monitor, timer, calls } = setup();

      monitor.install();
      monitor.uninstall();
      await timer.fire(); // fire all (should be none)

      expect(calls.length).toBe(0);
    });
  });

  describe('idempotent install/uninstall', () => {
    it('calling install twice does not create a second interval', () => {
      const { monitor, timer } = setup();

      monitor.install();
      monitor.install();

      expect(timer.activeCount).toBe(1);
    });

    it('calling uninstall without install is a no-op', () => {
      const { monitor } = setup();

      // Should not throw
      monitor.uninstall();
    });

    it('calling uninstall twice is a no-op', () => {
      const { monitor, timer } = setup();

      monitor.install();
      monitor.uninstall();
      monitor.uninstall();

      expect(timer.activeCount).toBe(0);
    });
  });

  describe('reinstall after uninstall', () => {
    it('can reinstall after uninstall', async () => {
      const { monitor, timer, calls } = setup();

      monitor.install();
      monitor.uninstall();
      monitor.install();

      expect(timer.activeCount).toBe(1);
      await timer.fire();
      expect(calls.length).toBe(1);
    });
  });
});
