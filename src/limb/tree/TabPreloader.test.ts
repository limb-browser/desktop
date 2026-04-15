// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { TabPreloader } from './TabPreloader.mjs';
import type { TabPreloaderProbe } from '../ports/TabPreloaderProbe';

function createFakeProbe(): TabPreloaderProbe & {
  calls: { method: string; nodeId: string }[];
} {
  const calls: { method: string; nodeId: string }[] = [];
  return {
    calls,
    preloadStarted(nodeId: string) {
      calls.push({ method: 'preloadStarted', nodeId });
    },
    preloadCompleted(nodeId: string) {
      calls.push({ method: 'preloadCompleted', nodeId });
    },
    preloadCancelled(nodeId: string) {
      calls.push({ method: 'preloadCancelled', nodeId });
    },
  };
}

describe('TabPreloader', () => {
  let preloader: TabPreloader;
  let probe: ReturnType<typeof createFakeProbe>;

  beforeEach(() => {
    probe = createFakeProbe();
    preloader = new TabPreloader(probe);
  });

  describe('preload candidate selection', () => {
    it('returns screenshot-high node as candidate when screen width exceeds preload threshold', () => {
      const tiers = new Map([
        ['n1', 'screenshot-high'],
      ]);

      const result = preloader.evaluate(tiers, 500);

      expect(result).toBe('n1');
    });

    it('returns null when no screenshot-high nodes exist', () => {
      const tiers = new Map([
        ['n1', 'favicon'],
        ['n2', 'screenshot-low'],
      ]);

      const result = preloader.evaluate(tiers, 500);

      expect(result).toBeNull();
    });

    it('returns null when screen width is at or below preload threshold', () => {
      const tiers = new Map([
        ['n1', 'screenshot-high'],
      ]);

      const result = preloader.evaluate(tiers, 450);

      expect(result).toBeNull();
    });

    it('returns null when screen width is below preload threshold', () => {
      const tiers = new Map([
        ['n1', 'screenshot-high'],
      ]);

      const result = preloader.evaluate(tiers, 400);

      expect(result).toBeNull();
    });
  });

  describe('preload budget (max 1 concurrent)', () => {
    it('does not start a second preload when one is already in progress', () => {
      const tiers = new Map([
        ['n1', 'screenshot-high'],
        ['n2', 'screenshot-high'],
      ]);

      // First evaluate starts preload for first screenshot-high node
      const first = preloader.evaluate(tiers, 500);
      expect(first).toBe('n1');

      // Second evaluate returns same node (still in progress), not n2
      const second = preloader.evaluate(tiers, 500);
      expect(second).toBe('n1');

      // Probe should only have fired once
      const starts = probe.calls.filter(c => c.method === 'preloadStarted');
      expect(starts).toHaveLength(1);
    });

    it('allows a new preload after previous one completes (node promoted to live)', () => {
      // Start preload for n1
      preloader.evaluate(
        new Map([['n1', 'screenshot-high'], ['n2', 'screenshot-high']]),
        500,
      );

      // n1 promoted to live - preload completed
      const result = preloader.evaluate(
        new Map([['n1', 'live'], ['n2', 'screenshot-high']]),
        500,
      );

      // Now n2 should be the new candidate
      expect(result).toBe('n2');

      const completions = probe.calls.filter(c => c.method === 'preloadCompleted');
      expect(completions).toHaveLength(1);
      expect(completions[0].nodeId).toBe('n1');
    });
  });

  describe('preload cancellation', () => {
    it('cancels preload when node drops below screenshot-high tier', () => {
      // Start preload
      preloader.evaluate(new Map([['n1', 'screenshot-high']]), 500);
      probe.calls.length = 0;

      // Node drops to screenshot-low (below 300px)
      const result = preloader.evaluate(new Map([['n1', 'screenshot-low']]), 200);

      expect(result).toBeNull();
      expect(probe.calls).toEqual([
        { method: 'preloadCancelled', nodeId: 'n1' },
      ]);
    });

    it('cancels preload when node becomes culled', () => {
      preloader.evaluate(new Map([['n1', 'screenshot-high']]), 500);
      probe.calls.length = 0;

      const result = preloader.evaluate(new Map([['n1', 'culled']]), 100);

      expect(result).toBeNull();
      expect(probe.calls).toEqual([
        { method: 'preloadCancelled', nodeId: 'n1' },
      ]);
    });

    it('cancels preload when node becomes favicon', () => {
      preloader.evaluate(new Map([['n1', 'screenshot-high']]), 500);
      probe.calls.length = 0;

      const result = preloader.evaluate(new Map([['n1', 'favicon']]), 50);

      expect(result).toBeNull();
      expect(probe.calls).toEqual([
        { method: 'preloadCancelled', nodeId: 'n1' },
      ]);
    });

    it('does not cancel when node promotes to live (completes instead)', () => {
      preloader.evaluate(new Map([['n1', 'screenshot-high']]), 500);
      probe.calls.length = 0;

      preloader.evaluate(new Map([['n1', 'live']]), 700);

      const cancels = probe.calls.filter(c => c.method === 'preloadCancelled');
      expect(cancels).toHaveLength(0);

      const completions = probe.calls.filter(c => c.method === 'preloadCompleted');
      expect(completions).toHaveLength(1);
      expect(completions[0].nodeId).toBe('n1');
    });

    it('does not cancel when node promotes to focused (completes instead)', () => {
      preloader.evaluate(new Map([['n1', 'screenshot-high']]), 500);
      probe.calls.length = 0;

      preloader.evaluate(new Map([['n1', 'focused']]), 700);

      const cancels = probe.calls.filter(c => c.method === 'preloadCancelled');
      expect(cancels).toHaveLength(0);

      const completions = probe.calls.filter(c => c.method === 'preloadCompleted');
      expect(completions).toHaveLength(1);
    });

    it('allows new preload after cancellation frees the slot', () => {
      // Start preload for n1
      preloader.evaluate(
        new Map([['n1', 'screenshot-high'], ['n2', 'screenshot-high']]),
        500,
      );

      // n1 drops, n2 still eligible
      const result = preloader.evaluate(
        new Map([['n1', 'screenshot-low'], ['n2', 'screenshot-high']]),
        500,
      );

      expect(result).toBe('n2');
    });
  });

  describe('probe observability', () => {
    it('fires preloadStarted when a preload begins', () => {
      preloader.evaluate(new Map([['n1', 'screenshot-high']]), 500);

      expect(probe.calls).toEqual([
        { method: 'preloadStarted', nodeId: 'n1' },
      ]);
    });

    it('fires preloadCompleted when preloaded node reaches live tier', () => {
      preloader.evaluate(new Map([['n1', 'screenshot-high']]), 500);
      probe.calls.length = 0;

      preloader.evaluate(new Map([['n1', 'live']]), 700);

      expect(probe.calls).toEqual([
        { method: 'preloadCompleted', nodeId: 'n1' },
      ]);
    });

    it('fires preloadCancelled when preloaded node drops below screenshot-high', () => {
      preloader.evaluate(new Map([['n1', 'screenshot-high']]), 500);
      probe.calls.length = 0;

      preloader.evaluate(new Map([['n1', 'screenshot-low']]), 200);

      expect(probe.calls).toEqual([
        { method: 'preloadCancelled', nodeId: 'n1' },
      ]);
    });

    it('does not fire any probe when no preload decision changes', () => {
      // Below threshold - no preload
      preloader.evaluate(new Map([['n1', 'screenshot-high']]), 400);

      expect(probe.calls).toHaveLength(0);
    });
  });

  describe('constructor without probe', () => {
    it('works without a probe', () => {
      const noProbPreloader = new TabPreloader();
      const result = noProbPreloader.evaluate(
        new Map([['n1', 'screenshot-high']]),
        500,
      );

      expect(result).toBe('n1');
    });
  });

  describe('preloadNodeId getter', () => {
    it('returns null when no preload is active', () => {
      expect(preloader.preloadNodeId).toBeNull();
    });

    it('returns the active preload node ID', () => {
      preloader.evaluate(new Map([['n1', 'screenshot-high']]), 500);

      expect(preloader.preloadNodeId).toBe('n1');
    });

    it('returns null after preload is cancelled', () => {
      preloader.evaluate(new Map([['n1', 'screenshot-high']]), 500);
      preloader.evaluate(new Map([['n1', 'screenshot-low']]), 200);

      expect(preloader.preloadNodeId).toBeNull();
    });

    it('returns null after preload completes', () => {
      preloader.evaluate(new Map([['n1', 'screenshot-high']]), 500);
      preloader.evaluate(new Map([['n1', 'live']]), 700);

      expect(preloader.preloadNodeId).toBeNull();
    });
  });
});
