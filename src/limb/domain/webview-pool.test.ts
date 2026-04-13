import { describe, it, expect, beforeEach } from 'vitest';
import { WebViewPool } from './webview-pool';
import { FakePoolProbe } from './__test-utils__/fake-pool-probe';
import { FakeWebViewHandleFactory } from './__test-utils__/fake-webview-handle';
import type { PoolConfig } from './webview-pool';

describe('WebViewPool', () => {
  let probe: FakePoolProbe;
  let factory: FakeWebViewHandleFactory;
  let config: PoolConfig;
  let pool: WebViewPool;
  let statusUpdates: string[];
  let statusUpdater: (nodeId: string) => void;

  beforeEach(() => {
    probe = new FakePoolProbe();
    factory = new FakeWebViewHandleFactory();
    config = { maxLive: 2, screenshotDelay: 500, preloadMargin: 200 };
    statusUpdates = [];
    statusUpdater = (nodeId: string) => { statusUpdates.push(nodeId); };
    pool = new WebViewPool(config, factory, probe, statusUpdater);
  });

  describe('acquire within pool cap', () => {
    it('adds to active map', () => {
      pool.acquire('node-1', 'https://a.com');

      expect(pool.active.has('node-1')).toBe(true);
      expect(pool.active.size).toBe(1);
    });

    it('creates a webview handle via factory', () => {
      pool.acquire('node-1', 'https://a.com');

      expect(factory.createdForNodeIds).toEqual(['node-1']);
    });

    it('navigates the handle to the given URL', () => {
      pool.acquire('node-1', 'https://a.com');

      expect(factory.created[0].navigatedTo).toBe('https://a.com');
    });

    it('allows multiple acquisitions up to maxLive', () => {
      pool.acquire('node-1', 'https://a.com');
      pool.acquire('node-2', 'https://b.com');

      expect(pool.active.size).toBe(2);
      expect(pool.active.has('node-1')).toBe(true);
      expect(pool.active.has('node-2')).toBe(true);
    });

    it('emits PoolProbe.webviewAcquired on acquire', () => {
      pool.acquire('node-1', 'https://a.com');

      expect(probe.acquiredNodeIds).toEqual(['node-1']);
    });

    it('emits webviewAcquired for each acquisition', () => {
      pool.acquire('node-1', 'https://a.com');
      pool.acquire('node-2', 'https://b.com');

      expect(probe.acquiredNodeIds).toEqual(['node-1', 'node-2']);
    });
  });

  describe('acquire when pool full triggers eviction of LRU node', () => {
    it('evicts the least-recently-visited node when pool is full', () => {
      pool.acquire('node-1', 'https://a.com');
      pool.acquire('node-2', 'https://b.com');
      pool.acquire('node-3', 'https://c.com');

      expect(pool.active.has('node-1')).toBe(false);
      expect(pool.active.has('node-2')).toBe(true);
      expect(pool.active.has('node-3')).toBe(true);
    });

    it('captures screenshot before destroying evicted handle', () => {
      pool.acquire('node-1', 'https://a.com');
      pool.acquire('node-2', 'https://b.com');
      pool.acquire('node-3', 'https://c.com');

      const evictedHandle = factory.created[0];
      const captureIndex = evictedHandle.callLog.indexOf('captureScreenshot');
      const destroyIndex = evictedHandle.callLog.indexOf('destroy');
      expect(captureIndex).toBeGreaterThanOrEqual(0);
      expect(destroyIndex).toBeGreaterThanOrEqual(0);
      expect(captureIndex).toBeLessThan(destroyIndex);
    });

    it('stores screenshot data during eviction', () => {
      pool.acquire('node-1', 'https://a.com');
      pool.acquire('node-2', 'https://b.com');
      pool.acquire('node-3', 'https://c.com');

      expect(pool.screenshots.has('node-1')).toBe(true);
      expect(pool.screenshots.get('node-1')).toBeInstanceOf(Uint8Array);
    });

    it('updates node status during eviction', () => {
      pool.acquire('node-1', 'https://a.com');
      pool.acquire('node-2', 'https://b.com');
      pool.acquire('node-3', 'https://c.com');

      expect(statusUpdates).toEqual(['node-1']);
    });

    it('updates node status before destroying the webview', () => {
      let destroyedAtStatusUpdate = true;
      const orderChecker = (_nodeId: string) => {
        destroyedAtStatusUpdate = factory.created[0].destroyed;
      };
      const checkedPool = new WebViewPool(config, factory, probe, orderChecker);
      checkedPool.acquire('node-1', 'https://a.com');
      checkedPool.acquire('node-2', 'https://b.com');
      checkedPool.acquire('node-3', 'https://c.com');

      expect(destroyedAtStatusUpdate).toBe(false);
    });

    it('emits PoolProbe.webviewEvicted for the evicted node', () => {
      pool.acquire('node-1', 'https://a.com');
      pool.acquire('node-2', 'https://b.com');
      pool.acquire('node-3', 'https://c.com');

      expect(probe.evictedNodeIds).toEqual(['node-1']);
    });

    it('emits webviewAcquired for the new node after eviction', () => {
      pool.acquire('node-1', 'https://a.com');
      pool.acquire('node-2', 'https://b.com');
      pool.acquire('node-3', 'https://c.com');

      expect(probe.acquiredNodeIds).toEqual(['node-1', 'node-2', 'node-3']);
    });
  });

  describe('eviction based on visit order, not acquisition order', () => {
    it('evicts the node with the oldest visit time after focus changes order', () => {
      pool.acquire('node-1', 'https://a.com');
      pool.acquire('node-2', 'https://b.com');
      // Focus node-1, updating its visit time to be more recent than node-2
      pool.setFocusedNodeId('node-1');
      pool.setFocusedNodeId(null);

      pool.acquire('node-3', 'https://c.com');

      // node-2 has older visit time (set at acquisition), node-1 was refreshed by focus
      expect(pool.active.has('node-1')).toBe(true);
      expect(pool.active.has('node-2')).toBe(false);
      expect(pool.active.has('node-3')).toBe(true);
      expect(probe.evictedNodeIds).toEqual(['node-2']);
    });
  });

  describe('focused node is never evicted', () => {
    it('evicts a non-focused node even if it was acquired later', () => {
      pool.acquire('node-1', 'https://a.com');
      pool.acquire('node-2', 'https://b.com');
      pool.setFocusedNodeId('node-1');

      pool.acquire('node-3', 'https://c.com');

      expect(pool.active.has('node-1')).toBe(true);
      expect(pool.active.has('node-2')).toBe(false);
      expect(pool.active.has('node-3')).toBe(true);
      expect(probe.evictedNodeIds).toEqual(['node-2']);
    });

    it('queues to pending and emits poolExhausted when only focused node is active', () => {
      const smallPool = new WebViewPool(
        { maxLive: 1, screenshotDelay: 500, preloadMargin: 200 },
        factory,
        probe,
        statusUpdater,
      );
      smallPool.acquire('node-1', 'https://a.com');
      smallPool.setFocusedNodeId('node-1');

      smallPool.acquire('node-2', 'https://b.com');

      expect(smallPool.active.has('node-1')).toBe(true);
      expect(smallPool.active.has('node-2')).toBe(false);
      expect(smallPool.pending.has('node-2')).toBe(true);
      expect(probe.exhaustedCalls).toHaveLength(1);
    });
  });

  describe('duplicate acquisition guard', () => {
    it('does not create a new handle when nodeId is already active', () => {
      pool.acquire('node-1', 'https://a.com');
      pool.acquire('node-1', 'https://b.com');

      expect(pool.active.size).toBe(1);
      expect(factory.created.length).toBe(1);
      expect(factory.created[0].navigatedTo).toBe('https://a.com');
    });

    it('does not emit webviewAcquired for duplicate acquisition', () => {
      pool.acquire('node-1', 'https://a.com');
      pool.acquire('node-1', 'https://b.com');

      expect(probe.acquiredNodeIds).toEqual(['node-1']);
    });

    it('does not trigger eviction for duplicate acquisition when pool is full', () => {
      pool.acquire('node-1', 'https://a.com');
      pool.acquire('node-2', 'https://b.com');
      // Pool is full. Re-acquiring node-1 should NOT evict anything.
      pool.acquire('node-1', 'https://c.com');

      expect(pool.active.size).toBe(2);
      expect(pool.active.has('node-1')).toBe(true);
      expect(pool.active.has('node-2')).toBe(true);
      expect(probe.evictedNodeIds).toEqual([]);
    });
  });

  describe('pool size never exceeds maxLive', () => {
    it('maintains pool cap after multiple acquisitions with evictions', () => {
      pool.acquire('node-1', 'https://a.com');
      pool.acquire('node-2', 'https://b.com');
      pool.acquire('node-3', 'https://c.com');
      pool.acquire('node-4', 'https://d.com');

      expect(pool.active.size).toBeLessThanOrEqual(config.maxLive);
      expect(pool.active.size).toBe(2);
    });

    it('pool size is exactly maxLive when acquiring beyond capacity', () => {
      for (let i = 0; i < 10; i++) {
        pool.acquire(`node-${i}`, `https://${i}.com`);
      }

      expect(pool.active.size).toBe(config.maxLive);
    });
  });

  describe('release', () => {
    it('removes the node from active', () => {
      pool.acquire('node-1', 'https://a.com');

      pool.release('node-1', true);

      expect(pool.active.has('node-1')).toBe(false);
      expect(pool.active.size).toBe(0);
    });

    it('emits webviewReleased probe event', () => {
      pool.acquire('node-1', 'https://a.com');

      pool.release('node-1', true);

      expect(probe.releasedNodeIds).toEqual(['node-1']);
    });

    it('destroys the webview handle', () => {
      pool.acquire('node-1', 'https://a.com');

      pool.release('node-1', true);

      expect(factory.created[0].destroyed).toBe(true);
    });

    it('captures screenshot before destroying the handle when visible', () => {
      pool.acquire('node-1', 'https://a.com');

      pool.release('node-1', true);

      const handle = factory.created[0];
      const captureIndex = handle.callLog.indexOf('captureScreenshot');
      const destroyIndex = handle.callLog.indexOf('destroy');
      expect(captureIndex).toBeGreaterThanOrEqual(0);
      expect(destroyIndex).toBeGreaterThanOrEqual(0);
      expect(captureIndex).toBeLessThan(destroyIndex);
    });

    it('stores the captured screenshot when visible', () => {
      pool.acquire('node-1', 'https://a.com');

      pool.release('node-1', true);

      expect(pool.screenshots.has('node-1')).toBe(true);
      expect(pool.screenshots.get('node-1')).toBeInstanceOf(Uint8Array);
    });

    it('is a no-op for a nodeId not in active', () => {
      pool.release('nonexistent', true);

      expect(probe.releasedNodeIds).toEqual([]);
      expect(pool.active.size).toBe(0);
    });

    it('skips screenshot capture when last captured less than 1 second ago', () => {
      pool.acquire('node-1', 'https://a.com');
      // Eviction captures a screenshot and sets lastCapturedAt
      pool.acquire('node-2', 'https://b.com');
      pool.acquire('node-3', 'https://c.com');
      // node-1 was evicted, now re-acquire it (node-2 gets evicted)
      pool.acquire('node-1', 'https://a.com');
      // node-1 was just captured during eviction, release immediately
      // The screenshot was captured < 1 second ago, so release should skip capture
      const handleForNode1 = factory.created[3]; // 4th handle created (re-acquisition of node-1)
      pool.release('node-1', true);

      // The handle should have been destroyed but captureScreenshot NOT called
      // because the screenshot was captured < 1 second ago during eviction
      expect(handleForNode1.destroyed).toBe(true);
      expect(handleForNode1.screenshotCaptured).toBe(false);
      expect(probe.releasedNodeIds).toEqual(['node-1']);
    });
  });

  describe('release frees slot for pending requests', () => {
    it('processes a pending node after release frees a slot', () => {
      const smallPool = new WebViewPool(
        { maxLive: 1, screenshotDelay: 500, preloadMargin: 200 },
        factory,
        probe,
        statusUpdater,
      );
      smallPool.acquire('node-1', 'https://a.com');
      smallPool.setFocusedNodeId('node-1');
      // Pool exhausted — node-2 goes to pending
      smallPool.acquire('node-2', 'https://b.com');
      expect(smallPool.pending.has('node-2')).toBe(true);

      // Release node-1 frees the slot
      smallPool.setFocusedNodeId(null);
      smallPool.release('node-1', true);

      expect(smallPool.active.has('node-2')).toBe(true);
      expect(smallPool.pending.has('node-2')).toBe(false);
      expect(probe.acquiredNodeIds).toContain('node-2');
    });

    it('emits webviewAcquired for the promoted pending node', () => {
      const smallPool = new WebViewPool(
        { maxLive: 1, screenshotDelay: 500, preloadMargin: 200 },
        factory,
        probe,
        statusUpdater,
      );
      smallPool.acquire('node-1', 'https://a.com');
      smallPool.setFocusedNodeId('node-1');
      smallPool.acquire('node-2', 'https://b.com');

      smallPool.setFocusedNodeId(null);
      smallPool.release('node-1', true);

      // Should have: acquired node-1, exhausted, released node-1, acquired node-2
      expect(probe.acquiredNodeIds).toEqual(['node-1', 'node-2']);
      expect(probe.releasedNodeIds).toEqual(['node-1']);
    });

    it('does not exceed maxLive when processing pending after release', () => {
      const smallPool = new WebViewPool(
        { maxLive: 1, screenshotDelay: 500, preloadMargin: 200 },
        factory,
        probe,
        statusUpdater,
      );
      smallPool.acquire('node-1', 'https://a.com');
      smallPool.setFocusedNodeId('node-1');
      smallPool.acquire('node-2', 'https://b.com');
      smallPool.acquire('node-3', 'https://c.com');

      smallPool.setFocusedNodeId(null);
      smallPool.release('node-1', true);

      // Only one pending node should be promoted (maxLive = 1)
      expect(smallPool.active.size).toBe(1);
      expect(smallPool.active.size).toBeLessThanOrEqual(1);
    });
  });

  describe('removeNode (no orphaned webviews)', () => {
    it('destroys the webview when a node is removed from the tree', () => {
      pool.acquire('node-1', 'https://a.com');

      pool.removeNode('node-1');

      expect(factory.created[0].destroyed).toBe(true);
      expect(pool.active.has('node-1')).toBe(false);
    });

    it('does not capture a screenshot when removing a node', () => {
      pool.acquire('node-1', 'https://a.com');

      pool.removeNode('node-1');

      expect(factory.created[0].screenshotCaptured).toBe(false);
    });

    it('removes a pending node from the pending set', () => {
      const smallPool = new WebViewPool(
        { maxLive: 1, screenshotDelay: 500, preloadMargin: 200 },
        factory,
        probe,
        statusUpdater,
      );
      smallPool.acquire('node-1', 'https://a.com');
      smallPool.setFocusedNodeId('node-1');
      smallPool.acquire('node-2', 'https://b.com');
      expect(smallPool.pending.has('node-2')).toBe(true);

      smallPool.removeNode('node-2');

      expect(smallPool.pending.has('node-2')).toBe(false);
    });

    it('cleans up screenshots when a node is removed', () => {
      pool.acquire('node-1', 'https://a.com');
      pool.acquire('node-2', 'https://b.com');
      // Evict node-1 to create a screenshot
      pool.acquire('node-3', 'https://c.com');
      expect(pool.screenshots.has('node-1')).toBe(true);

      pool.removeNode('node-1');

      expect(pool.screenshots.has('node-1')).toBe(false);
    });

    it('is a no-op for a nodeId not in active or pending', () => {
      pool.removeNode('nonexistent');

      expect(pool.active.size).toBe(0);
    });

    it('processes pending queue after freeing a slot', () => {
      const smallPool = new WebViewPool(
        { maxLive: 1, screenshotDelay: 500, preloadMargin: 200 },
        factory,
        probe,
        statusUpdater,
      );
      smallPool.acquire('node-1', 'https://a.com');
      smallPool.setFocusedNodeId('node-1');
      smallPool.acquire('node-2', 'https://b.com');
      expect(smallPool.pending.has('node-2')).toBe(true);

      smallPool.removeNode('node-1');

      expect(smallPool.active.has('node-2')).toBe(true);
      expect(smallPool.pending.has('node-2')).toBe(false);
      expect(probe.acquiredNodeIds).toContain('node-2');
    });
  });

  describe('duplicate pending guard in acquire', () => {
    it('does not emit poolExhausted for already-pending nodeId', () => {
      const smallPool = new WebViewPool(
        { maxLive: 1, screenshotDelay: 500, preloadMargin: 200 },
        factory,
        probe,
        statusUpdater,
      );
      smallPool.acquire('node-1', 'https://a.com');
      smallPool.setFocusedNodeId('node-1');
      smallPool.acquire('node-2', 'https://b.com');
      expect(probe.exhaustedCalls).toHaveLength(1);

      // Second acquire of the same pending node should be a no-op
      smallPool.acquire('node-2', 'https://b-updated.com');

      expect(probe.exhaustedCalls).toHaveLength(1);
      expect(smallPool.pending.has('node-2')).toBe(true);
    });

    it('does not overwrite pending URL for already-pending nodeId', () => {
      const smallPool = new WebViewPool(
        { maxLive: 1, screenshotDelay: 500, preloadMargin: 200 },
        factory,
        probe,
        statusUpdater,
      );
      smallPool.acquire('node-1', 'https://a.com');
      smallPool.setFocusedNodeId('node-1');
      smallPool.acquire('node-2', 'https://original.com');
      smallPool.acquire('node-2', 'https://overwritten.com');

      // Release node-1 to promote node-2 from pending
      smallPool.setFocusedNodeId(null);
      smallPool.release('node-2', true);  // node-2 not active, no-op release
      smallPool.release('node-1', true);

      // node-2 should navigate to original URL, not overwritten
      const node2Handle = factory.created[1]; // second handle created
      expect(node2Handle.navigatedTo).toBe('https://original.com');
    });
  });

  describe('release visibility check', () => {
    it('captures screenshot when visible and last captured > 1 second ago', () => {
      pool.acquire('node-1', 'https://a.com');

      pool.release('node-1', true);

      const handle = factory.created[0];
      expect(handle.screenshotCaptured).toBe(true);
      expect(pool.screenshots.has('node-1')).toBe(true);
    });

    it('skips screenshot capture when node is not visible', () => {
      pool.acquire('node-1', 'https://a.com');

      pool.release('node-1', false);

      const handle = factory.created[0];
      expect(handle.screenshotCaptured).toBe(false);
      expect(pool.screenshots.has('node-1')).toBe(false);
    });

    it('still destroys webview and emits probe when not visible', () => {
      pool.acquire('node-1', 'https://a.com');

      pool.release('node-1', false);

      const handle = factory.created[0];
      expect(handle.destroyed).toBe(true);
      expect(pool.active.has('node-1')).toBe(false);
      expect(probe.releasedNodeIds).toEqual(['node-1']);
    });
  });
});
