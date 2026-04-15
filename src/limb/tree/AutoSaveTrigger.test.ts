// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { AutoSaveTrigger } from './AutoSaveTrigger';
import { FakeTimerPort } from './FakeTimerPort';
import type { AutoSaveProbe } from '../ports/AutoSaveProbe';

function createFakeProbe(): AutoSaveProbe & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    saveTriggered(reason: 'change' | 'periodic' | 'shutdown') {
      calls.push({ method: 'saveTriggered', args: [reason] });
    },
    saveDebounced(pendingCount: number) {
      calls.push({ method: 'saveDebounced', args: [pendingCount] });
    },
    periodicFlushStarted() {
      calls.push({ method: 'periodicFlushStarted', args: [] });
    },
    periodicFlushStopped() {
      calls.push({ method: 'periodicFlushStopped', args: [] });
    },
  };
}

describe('AutoSaveTrigger', () => {
  let timer: FakeTimerPort;
  let saveCount: number;
  let saveFn: () => void;
  let probe: ReturnType<typeof createFakeProbe>;
  let trigger: AutoSaveTrigger;

  beforeEach(() => {
    timer = new FakeTimerPort();
    saveCount = 0;
    saveFn = () => { saveCount++; };
    probe = createFakeProbe();
    trigger = new AutoSaveTrigger(saveFn, timer, probe);
  });

  describe('change-triggered save', () => {
    it('saves after debounce period on notifyChange', () => {
      trigger.notifyChange();
      expect(saveCount).toBe(0);

      timer.advance(1000);
      expect(saveCount).toBe(1);
    });

    it('fires saveTriggered probe with reason "change"', () => {
      trigger.notifyChange();
      timer.advance(1000);

      const saveEvents = probe.calls.filter(
        (c) => c.method === 'saveTriggered'
      );
      expect(saveEvents).toHaveLength(1);
      expect(saveEvents[0].args).toEqual(['change']);
    });

    it('does not save before debounce period expires', () => {
      trigger.notifyChange();
      timer.advance(999);
      expect(saveCount).toBe(0);
    });
  });

  describe('debouncing rapid saves', () => {
    it('batches multiple rapid changes into a single save', () => {
      trigger.notifyChange();
      timer.advance(200);
      trigger.notifyChange();
      timer.advance(200);
      trigger.notifyChange();

      // 1000ms from last notifyChange
      timer.advance(1000);
      expect(saveCount).toBe(1);
    });

    it('resets debounce timer on each notifyChange', () => {
      trigger.notifyChange();
      timer.advance(900);
      // Reset debounce
      trigger.notifyChange();
      timer.advance(900);
      // Still no save - debounce was reset
      expect(saveCount).toBe(0);

      timer.advance(100);
      // Now 1000ms from last notifyChange
      expect(saveCount).toBe(1);
    });

    it('fires saveDebounced probe when a change resets the timer', () => {
      trigger.notifyChange();
      timer.advance(500);
      trigger.notifyChange();

      const debounced = probe.calls.filter(
        (c) => c.method === 'saveDebounced'
      );
      expect(debounced).toHaveLength(1);
      expect(debounced[0].args).toEqual([2]);
    });

    it('fires saveDebounced with incrementing count for each batch', () => {
      trigger.notifyChange();
      timer.advance(100);
      trigger.notifyChange();
      timer.advance(100);
      trigger.notifyChange();

      const debounced = probe.calls.filter(
        (c) => c.method === 'saveDebounced'
      );
      expect(debounced).toHaveLength(2);
      expect(debounced[0].args).toEqual([2]);
      expect(debounced[1].args).toEqual([3]);
    });
  });

  describe('periodic flush', () => {
    it('saves every 30 seconds after startPeriodicFlush', () => {
      trigger.startPeriodicFlush();

      timer.advance(30_000);
      expect(saveCount).toBe(1);

      timer.advance(30_000);
      expect(saveCount).toBe(2);

      timer.advance(30_000);
      expect(saveCount).toBe(3);
    });

    it('fires saveTriggered probe with reason "periodic"', () => {
      trigger.startPeriodicFlush();
      timer.advance(30_000);

      const events = probe.calls.filter(
        (c) => c.method === 'saveTriggered' && c.args[0] === 'periodic'
      );
      expect(events).toHaveLength(1);
    });

    it('fires periodicFlushStarted probe', () => {
      trigger.startPeriodicFlush();

      const events = probe.calls.filter(
        (c) => c.method === 'periodicFlushStarted'
      );
      expect(events).toHaveLength(1);
    });

    it('stops periodic flush on stopPeriodicFlush', () => {
      trigger.startPeriodicFlush();
      timer.advance(30_000);
      expect(saveCount).toBe(1);

      trigger.stopPeriodicFlush();
      timer.advance(30_000);
      expect(saveCount).toBe(1);
    });

    it('fires periodicFlushStopped probe', () => {
      trigger.startPeriodicFlush();
      trigger.stopPeriodicFlush();

      const events = probe.calls.filter(
        (c) => c.method === 'periodicFlushStopped'
      );
      expect(events).toHaveLength(1);
    });

    it('does not save before 30 seconds', () => {
      trigger.startPeriodicFlush();
      timer.advance(29_999);
      expect(saveCount).toBe(0);
    });
  });

  describe('saveNow (shutdown)', () => {
    it('saves immediately', () => {
      trigger.saveNow();
      expect(saveCount).toBe(1);
    });

    it('fires saveTriggered probe with reason "shutdown"', () => {
      trigger.saveNow();

      const events = probe.calls.filter(
        (c) => c.method === 'saveTriggered' && c.args[0] === 'shutdown'
      );
      expect(events).toHaveLength(1);
    });

    it('cancels pending debounce', () => {
      trigger.notifyChange();
      timer.advance(500);
      // saveNow fires immediately
      trigger.saveNow();
      expect(saveCount).toBe(1);

      // The debounced save should not fire
      timer.advance(1000);
      expect(saveCount).toBe(1);
    });
  });

  describe('dispose', () => {
    it('stops periodic flush', () => {
      trigger.startPeriodicFlush();
      trigger.dispose();

      timer.advance(30_000);
      expect(saveCount).toBe(0);
    });

    it('cancels pending debounce', () => {
      trigger.notifyChange();
      trigger.dispose();

      timer.advance(1000);
      expect(saveCount).toBe(0);
    });

    it('clears all timers', () => {
      trigger.startPeriodicFlush();
      trigger.notifyChange();
      trigger.dispose();

      expect(timer.pendingTimeoutCount).toBe(0);
      expect(timer.pendingIntervalCount).toBe(0);
    });
  });

  describe('without probe', () => {
    it('works without a probe', () => {
      const noProbeTrigger = new AutoSaveTrigger(saveFn, timer);
      noProbeTrigger.notifyChange();
      timer.advance(1000);
      expect(saveCount).toBe(1);

      noProbeTrigger.startPeriodicFlush();
      timer.advance(30_000);
      expect(saveCount).toBe(2);

      noProbeTrigger.saveNow();
      expect(saveCount).toBe(3);

      noProbeTrigger.dispose();
    });
  });
});
