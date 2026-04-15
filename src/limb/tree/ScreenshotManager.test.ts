// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { ScreenshotManager } from './ScreenshotManager.mjs';
import { InMemoryTabPort, type FakeTab } from './InMemoryTabPort';
import { InMemoryScreenshotCapturePort } from './InMemoryScreenshotCapturePort';
import type { ScreenshotManagerProbe } from '../ports/ScreenshotManagerProbe';

interface ProbeEvent {
  method: string;
  args: unknown[];
}

function recordingProbe(): { probe: ScreenshotManagerProbe; events: ProbeEvent[] } {
  const events: ProbeEvent[] = [];
  const probe: ScreenshotManagerProbe = {
    screenshotCaptured(nodeId, resolution) {
      events.push({ method: 'screenshotCaptured', args: [nodeId, resolution] });
    },
    tabSuspended(nodeId) {
      events.push({ method: 'tabSuspended', args: [nodeId] });
    },
    tabRestored(nodeId) {
      events.push({ method: 'tabRestored', args: [nodeId] });
    },
    preloadStarted(nodeId) {
      events.push({ method: 'preloadStarted', args: [nodeId] });
    },
    preloadFinished(nodeId) {
      events.push({ method: 'preloadFinished', args: [nodeId] });
    },
  };
  return { probe, events };
}

describe('ScreenshotManager', () => {
  let tabPort: InMemoryTabPort;
  let capturePort: InMemoryScreenshotCapturePort;
  let tabMap: Map<string, FakeTab>;
  let manager: ScreenshotManager;
  let probeEvents: ProbeEvent[];

  beforeEach(() => {
    tabPort = new InMemoryTabPort();
    capturePort = new InMemoryScreenshotCapturePort();
    tabMap = new Map();
    const { probe, events } = recordingProbe();
    probeEvents = events;
    manager = new ScreenshotManager(
      capturePort,
      tabPort,
      (nodeId: string) => tabMap.get(nodeId),
      probe,
    );
  });

  async function createTab(nodeId: string, url = 'https://example.com'): Promise<FakeTab> {
    const tab = await tabPort.openTab(url, nodeId);
    tabMap.set(nodeId, tab);
    return tab;
  }

  describe('Live to Screenshot tier transition', () => {
    it('captures a screenshot when a tab transitions from live to screenshot-high', async () => {
      const tab = await createTab('node-1');

      await manager.onTierChanged('node-1', 'live', 'screenshot-high');

      expect(capturePort.captures).toHaveLength(1);
      expect(capturePort.captures[0].tab).toBe(tab);
    });

    it('uses high-res resolution (1024px, quality 85) for screenshot-high tier', async () => {
      await createTab('node-1');

      await manager.onTierChanged('node-1', 'live', 'screenshot-high');

      expect(capturePort.captures[0].width).toBe(1024);
      expect(capturePort.captures[0].quality).toBe(85);
    });

    it('uses low-res resolution (320px, quality 60) for screenshot-low tier', async () => {
      await createTab('node-1');

      await manager.onTierChanged('node-1', 'live', 'screenshot-low');

      expect(capturePort.captures[0].width).toBe(320);
      expect(capturePort.captures[0].quality).toBe(60);
    });

    it('suspends the tab after capturing the screenshot', async () => {
      const tab = await createTab('node-1');

      await manager.onTierChanged('node-1', 'live', 'screenshot-high');

      expect(tab.suspended).toBe(true);
    });

    it('captures then suspends in order', async () => {
      await createTab('node-1');

      await manager.onTierChanged('node-1', 'live', 'screenshot-high');

      const captureIdx = probeEvents.findIndex(
        (e) => e.method === 'screenshotCaptured',
      );
      const suspendIdx = probeEvents.findIndex(
        (e) => e.method === 'tabSuspended',
      );
      expect(captureIdx).toBeLessThan(suspendIdx);
    });

    it('stores the screenshot keyed by nodeId and resolution', async () => {
      await createTab('node-1');

      await manager.onTierChanged('node-1', 'live', 'screenshot-high');

      const screenshot = manager.getScreenshot('node-1', 'high');
      expect(screenshot).not.toBeNull();
      expect(screenshot!.width).toBe(1024);
    });

    it('handles transition from focused to screenshot-high', async () => {
      const tab = await createTab('node-1');

      await manager.onTierChanged('node-1', 'focused', 'screenshot-high');

      expect(capturePort.captures).toHaveLength(1);
      expect(tab.suspended).toBe(true);
    });

    it('fires screenshotCaptured and tabSuspended probes', async () => {
      await createTab('node-1');

      await manager.onTierChanged('node-1', 'live', 'screenshot-high');

      expect(probeEvents).toContainEqual({
        method: 'screenshotCaptured',
        args: ['node-1', 'high'],
      });
      expect(probeEvents).toContainEqual({
        method: 'tabSuspended',
        args: ['node-1'],
      });
    });

    it('does nothing if the node has no tab', async () => {
      await manager.onTierChanged('node-missing', 'live', 'screenshot-high');

      expect(capturePort.captures).toHaveLength(0);
      expect(probeEvents).toHaveLength(0);
    });
  });

  describe('Screenshot to Live tier transition', () => {
    it('restores the tab when promoted from screenshot-high to live', async () => {
      const tab = await createTab('node-1');
      tab.suspended = true;

      await manager.onTierChanged('node-1', 'screenshot-high', 'live');

      expect(tab.suspended).toBe(false);
    });

    it('restores the tab when promoted from screenshot-low to live', async () => {
      const tab = await createTab('node-1');
      tab.suspended = true;

      await manager.onTierChanged('node-1', 'screenshot-low', 'live');

      expect(tab.suspended).toBe(false);
    });

    it('restores the tab when promoted to focused tier', async () => {
      const tab = await createTab('node-1');
      tab.suspended = true;

      await manager.onTierChanged('node-1', 'screenshot-high', 'focused');

      expect(tab.suspended).toBe(false);
    });

    it('fires tabRestored probe', async () => {
      const tab = await createTab('node-1');
      tab.suspended = true;

      await manager.onTierChanged('node-1', 'screenshot-high', 'live');

      expect(probeEvents).toContainEqual({
        method: 'tabRestored',
        args: ['node-1'],
      });
    });

    it('fires preloadStarted and preloadFinished probes', async () => {
      const tab = await createTab('node-1');
      tab.suspended = true;

      await manager.onTierChanged('node-1', 'screenshot-high', 'live');

      expect(probeEvents).toContainEqual({
        method: 'preloadStarted',
        args: ['node-1'],
      });
      expect(probeEvents).toContainEqual({
        method: 'preloadFinished',
        args: ['node-1'],
      });
    });

    it('does nothing if the node has no tab', async () => {
      await manager.onTierChanged('node-missing', 'screenshot-high', 'live');

      expect(probeEvents).toHaveLength(0);
    });
  });

  describe('preload budget', () => {
    it('allows one concurrent preload', async () => {
      const tab = await createTab('node-1');
      tab.suspended = true;

      await manager.onTierChanged('node-1', 'screenshot-high', 'live');

      expect(tab.suspended).toBe(false);
    });

    it('skips restore when preload budget is exhausted', async () => {
      const tab1 = await createTab('node-1');
      const tab2 = await createTab('node-2');
      tab1.suspended = true;
      tab2.suspended = true;

      // Make tab1 restore hang by replacing restoreTab with a slow version
      let resolveRestore!: () => void;
      const originalRestore = tabPort.restoreTab.bind(tabPort);
      let restoreCount = 0;
      tabPort.restoreTab = async (tab: FakeTab) => {
        restoreCount++;
        if (restoreCount === 1) {
          // First restore hangs until we resolve it
          await new Promise<void>((resolve) => {
            resolveRestore = resolve;
          });
        }
        return originalRestore(tab);
      };

      // Start restoring node-1 (uses the preload slot)
      const restore1 = manager.onTierChanged('node-1', 'screenshot-high', 'live');
      // Give the first restore a tick to start
      await Promise.resolve();

      // Try to restore node-2 while node-1 is in progress
      await manager.onTierChanged('node-2', 'screenshot-high', 'live');

      // node-2 should still be suspended (budget exhausted)
      expect(tab2.suspended).toBe(true);

      // Complete node-1's restore
      resolveRestore();
      await restore1;

      expect(tab1.suspended).toBe(false);
    });

    it('frees the preload slot after restore completes', async () => {
      const tab1 = await createTab('node-1');
      const tab2 = await createTab('node-2');
      tab1.suspended = true;
      tab2.suspended = true;

      // Restore node-1 first (finishes immediately)
      await manager.onTierChanged('node-1', 'screenshot-high', 'live');
      expect(tab1.suspended).toBe(false);

      // Now restore node-2 (preload slot is free)
      await manager.onTierChanged('node-2', 'screenshot-high', 'live');
      expect(tab2.suspended).toBe(false);
    });
  });

  describe('non-transition tiers', () => {
    it('ignores screenshot-high to screenshot-low transition', async () => {
      await createTab('node-1');

      await manager.onTierChanged('node-1', 'screenshot-high', 'screenshot-low');

      expect(capturePort.captures).toHaveLength(0);
      expect(probeEvents).toHaveLength(0);
    });

    it('ignores favicon to screenshot-low transition', async () => {
      await createTab('node-1');

      await manager.onTierChanged('node-1', 'favicon', 'screenshot-low');

      expect(capturePort.captures).toHaveLength(0);
      expect(probeEvents).toHaveLength(0);
    });

    it('ignores live to focused transition', async () => {
      await createTab('node-1');

      await manager.onTierChanged('node-1', 'live', 'focused');

      expect(capturePort.captures).toHaveLength(0);
      expect(probeEvents).toHaveLength(0);
    });

    it('ignores focused to live transition', async () => {
      await createTab('node-1');

      await manager.onTierChanged('node-1', 'focused', 'live');

      expect(capturePort.captures).toHaveLength(0);
      expect(probeEvents).toHaveLength(0);
    });

    it('ignores culled to favicon transition', async () => {
      await createTab('node-1');

      await manager.onTierChanged('node-1', 'culled', 'favicon');

      expect(capturePort.captures).toHaveLength(0);
      expect(probeEvents).toHaveLength(0);
    });
  });

  describe('getScreenshot', () => {
    it('returns null for node with no screenshots', () => {
      expect(manager.getScreenshot('node-x', 'high')).toBeNull();
    });

    it('returns the stored screenshot for the matching resolution', async () => {
      await createTab('node-1');
      await manager.onTierChanged('node-1', 'live', 'screenshot-high');

      const screenshot = manager.getScreenshot('node-1', 'high');
      expect(screenshot).not.toBeNull();
      expect(screenshot!.width).toBe(1024);
    });

    it('returns null for a different resolution than stored', async () => {
      await createTab('node-1');
      await manager.onTierChanged('node-1', 'live', 'screenshot-high');

      expect(manager.getScreenshot('node-1', 'low')).toBeNull();
    });

    it('stores screenshots independently per resolution', async () => {
      await createTab('node-1');

      // Capture high-res
      await manager.onTierChanged('node-1', 'live', 'screenshot-high');
      // Simulate returning to live and then demoting to low-res
      await createTab('node-1'); // re-create (tab was suspended)
      tabMap.get('node-1')!.suspended = false;
      await manager.onTierChanged('node-1', 'live', 'screenshot-low');

      expect(manager.getScreenshot('node-1', 'high')!.width).toBe(1024);
      expect(manager.getScreenshot('node-1', 'low')!.width).toBe(320);
    });
  });

  describe('captureScreenshot', () => {
    it('captures at low resolution (320px, quality 60)', async () => {
      await createTab('node-1');

      await manager.captureScreenshot('node-1', 'low');

      expect(capturePort.captures).toHaveLength(1);
      expect(capturePort.captures[0].width).toBe(320);
      expect(capturePort.captures[0].quality).toBe(60);
    });

    it('captures at high resolution (1024px, quality 85)', async () => {
      await createTab('node-1');

      await manager.captureScreenshot('node-1', 'high');

      expect(capturePort.captures).toHaveLength(1);
      expect(capturePort.captures[0].width).toBe(1024);
      expect(capturePort.captures[0].quality).toBe(85);
    });

    it('stores the captured screenshot', async () => {
      await createTab('node-1');

      await manager.captureScreenshot('node-1', 'high');

      expect(manager.getScreenshot('node-1', 'high')).not.toBeNull();
    });

    it('does not suspend the tab', async () => {
      const tab = await createTab('node-1');

      await manager.captureScreenshot('node-1', 'high');

      expect(tab.suspended).toBe(false);
    });

    it('does nothing if the node has no tab', async () => {
      await manager.captureScreenshot('node-missing', 'high');

      expect(capturePort.captures).toHaveLength(0);
    });

    it('fires screenshotCaptured probe', async () => {
      await createTab('node-1');

      await manager.captureScreenshot('node-1', 'low');

      expect(probeEvents).toContainEqual({
        method: 'screenshotCaptured',
        args: ['node-1', 'low'],
      });
    });
  });

  describe('without probe', () => {
    it('operates correctly when no probe is provided', async () => {
      const noProbeMgr = new ScreenshotManager(
        capturePort,
        tabPort,
        (nodeId: string) => tabMap.get(nodeId),
      );
      const tab = await createTab('node-1');

      await noProbeMgr.onTierChanged('node-1', 'live', 'screenshot-high');

      expect(capturePort.captures).toHaveLength(1);
      expect(tab.suspended).toBe(true);
    });
  });
});
