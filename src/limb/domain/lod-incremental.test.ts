import { describe, it, expect } from 'vitest';
import { IncrementalLOD, NodePriority } from './lod-incremental';
import { FakeLODProbe } from './__test-utils__/fake-lod-probe';
import { FakePerformanceProbe } from './__test-utils__/fake-performance-probe';
import type { LODTier } from '../ports/lod-probe';
import type { ZoomState } from './zoom';

function makeZoomState(overrides: Partial<ZoomState> = {}): ZoomState {
  return {
    level: 1.0,
    focusPoint: { x: 0, y: 0 },
    viewportSize: { width: 1920, height: 1080 },
    ...overrides,
  };
}

// Minimal tree interface for IncrementalLOD
interface TreeShape {
  focusedNodeId: string;
  getAncestorIds(nodeId: string): string[];
  getSiblingIds(nodeId: string): string[];
  getDescendantIds(nodeId: string): string[];
}

function makeTree(focusedNodeId: string, relationships: {
  ancestors?: string[];
  siblings?: string[];
  descendants?: string[];
} = {}): TreeShape {
  const { ancestors = [], siblings = [], descendants = [] } = relationships;
  return {
    focusedNodeId,
    getAncestorIds: (nodeId: string) => nodeId === focusedNodeId ? ancestors : [],
    getSiblingIds: (nodeId: string) => nodeId === focusedNodeId ? siblings : [],
    getDescendantIds: (nodeId: string) => nodeId === focusedNodeId ? descendants : [],
  };
}

describe('IncrementalLOD', () => {
  describe('dirty flags', () => {
    it('only dirty nodes are recomputed', () => {
      const lodProbe = new FakeLODProbe();
      const perfProbe = new FakePerformanceProbe();
      const lod = new IncrementalLOD(lodProbe, perfProbe);
      const tree = makeTree('node-a');
      const layout = new Map([
        ['node-a', { x: 0, y: 0 }],
        ['node-b', { x: 1, y: 0 }],
        ['node-c', { x: 2, y: 0 }],
      ]);
      const zoomState = makeZoomState();
      const visibility = new Map([
        ['node-a', true],
        ['node-b', true],
        ['node-c', true],
      ]);

      // Initial computation — all nodes should be processed
      lod.markAllDirty(['node-a', 'node-b', 'node-c']);
      const tiers1 = lod.computeFrame(tree, layout, zoomState, visibility);
      expect(tiers1.size).toBe(3);

      // Clear probe records
      lodProbe.assignments.length = 0;

      // Only mark node-b dirty
      lod.markDirty('node-b');
      const tiers2 = lod.computeFrame(tree, layout, zoomState, visibility);

      // Only node-b should have been reassigned
      const assignedIds = lodProbe.assignments.map(a => a.nodeId);
      expect(assignedIds).toContain('node-b');
      expect(assignedIds).not.toContain('node-a');
      expect(assignedIds).not.toContain('node-c');

      // But the full tier map is returned (dirty + cached)
      expect(tiers2.size).toBe(3);
    });

    it('clean nodes retain their previous tier', () => {
      const lodProbe = new FakeLODProbe();
      const perfProbe = new FakePerformanceProbe();
      const lod = new IncrementalLOD(lodProbe, perfProbe);
      const tree = makeTree('node-a');
      const layout = new Map([
        ['node-a', { x: 0, y: 0 }],
        ['node-b', { x: 1, y: 0 }],
      ]);
      const zoomState = makeZoomState();
      const visibility = new Map([
        ['node-a', true],
        ['node-b', true],
      ]);

      lod.markAllDirty(['node-a', 'node-b']);
      const tiers1 = lod.computeFrame(tree, layout, zoomState, visibility);
      const tierB = tiers1.get('node-b')!;

      // No dirty nodes — nothing recomputed, cached tiers returned
      const tiers2 = lod.computeFrame(tree, layout, zoomState, visibility);
      expect(tiers2.get('node-b')).toBe(tierB);
    });
  });

  describe('viewport boundary marking', () => {
    it('zoom/pan marks viewport-boundary nodes dirty', () => {
      const lodProbe = new FakeLODProbe();
      const perfProbe = new FakePerformanceProbe();
      const lod = new IncrementalLOD(lodProbe, perfProbe);

      // Set up a spatial index with nodes spread out
      const layout = new Map([
        ['center', { x: 5, y: 5 }],
        ['edge', { x: 10, y: 5 }],
        ['far', { x: 50, y: 50 }],
      ]);
      lod.syncIndex(layout);

      // Initial computation
      const tree = makeTree('center');
      const zoomState = makeZoomState({ focusPoint: { x: 5, y: 5 } });
      const visibility = new Map([
        ['center', true],
        ['edge', true],
        ['far', false],
      ]);

      lod.markAllDirty(['center', 'edge', 'far']);
      lod.computeFrame(tree, layout, zoomState, visibility);
      lodProbe.assignments.length = 0;

      // Now simulate a pan — the viewport moves. Nodes near the boundary
      // should be marked dirty via onViewportChange.
      const newZoomState = makeZoomState({ focusPoint: { x: 10, y: 5 } });
      const newVisibility = new Map([
        ['center', true],
        ['edge', true],
        ['far', false],
      ]);
      lod.onViewportChange(newZoomState, layout);
      const tiers = lod.computeFrame(tree, layout, newZoomState, newVisibility);

      // At least some nodes should have been recomputed (boundary nodes marked dirty)
      expect(lodProbe.assignments.length).toBeGreaterThan(0);
    });
  });

  describe('priority ordering', () => {
    it('focused > ancestors > siblings > descendants > distant', () => {
      const lodProbe = new FakeLODProbe();
      const perfProbe = new FakePerformanceProbe();
      const lod = new IncrementalLOD(lodProbe, perfProbe);

      const tree: TreeShape = {
        focusedNodeId: 'focused',
        getAncestorIds: (nodeId: string) => nodeId === 'focused' ? ['ancestor'] : [],
        getSiblingIds: (nodeId: string) => nodeId === 'focused' ? ['sibling'] : [],
        getDescendantIds: (nodeId: string) => nodeId === 'focused' ? ['descendant'] : [],
      };

      const layout = new Map([
        ['focused', { x: 0, y: 0 }],
        ['ancestor', { x: 1, y: 0 }],
        ['sibling', { x: 2, y: 0 }],
        ['descendant', { x: 3, y: 0 }],
        ['distant', { x: 4, y: 0 }],
      ]);
      const zoomState = makeZoomState();
      const visibility = new Map([
        ['focused', true],
        ['ancestor', true],
        ['sibling', true],
        ['descendant', true],
        ['distant', true],
      ]);

      // All dirty
      lod.markAllDirty(['focused', 'ancestor', 'sibling', 'descendant', 'distant']);

      // Use prioritizeNodes directly to verify ordering
      const prioritized = lod.prioritizeNodes(
        ['distant', 'descendant', 'sibling', 'ancestor', 'focused'],
        tree
      );

      expect(prioritized[0]).toBe('focused');
      expect(prioritized[1]).toBe('ancestor');
      expect(prioritized[2]).toBe('sibling');
      expect(prioritized[3]).toBe('descendant');
      expect(prioritized[4]).toBe('distant');
    });

    it('nodes are processed in priority order during computeFrame', () => {
      const lodProbe = new FakeLODProbe();
      const perfProbe = new FakePerformanceProbe();
      const lod = new IncrementalLOD(lodProbe, perfProbe);

      const tree: TreeShape = {
        focusedNodeId: 'focused',
        getAncestorIds: (nodeId: string) => nodeId === 'focused' ? ['ancestor'] : [],
        getSiblingIds: (nodeId: string) => nodeId === 'focused' ? ['sibling'] : [],
        getDescendantIds: (nodeId: string) => nodeId === 'focused' ? ['descendant'] : [],
      };

      const layout = new Map([
        ['focused', { x: 0, y: 0 }],
        ['ancestor', { x: 1, y: 0 }],
        ['sibling', { x: 2, y: 0 }],
        ['descendant', { x: 3, y: 0 }],
        ['distant', { x: 4, y: 0 }],
      ]);
      const zoomState = makeZoomState();
      const visibility = new Map([
        ['focused', true],
        ['ancestor', true],
        ['sibling', true],
        ['descendant', true],
        ['distant', true],
      ]);

      lod.markAllDirty(['focused', 'ancestor', 'sibling', 'descendant', 'distant']);
      lod.computeFrame(tree, layout, zoomState, visibility);

      // Verify probe assignments follow priority order
      const assignedOrder = lodProbe.assignments.map(a => a.nodeId);
      const focusedIdx = assignedOrder.indexOf('focused');
      const ancestorIdx = assignedOrder.indexOf('ancestor');
      const siblingIdx = assignedOrder.indexOf('sibling');
      const descendantIdx = assignedOrder.indexOf('descendant');
      const distantIdx = assignedOrder.indexOf('distant');

      expect(focusedIdx).toBeLessThan(ancestorIdx);
      expect(ancestorIdx).toBeLessThan(siblingIdx);
      expect(siblingIdx).toBeLessThan(descendantIdx);
      expect(descendantIdx).toBeLessThan(distantIdx);
    });
  });

  describe('frame budget', () => {
    it('when computation exceeds 4ms budget, remaining nodes are deferred', () => {
      const lodProbe = new FakeLODProbe();
      const perfProbe = new FakePerformanceProbe();

      // Inject a fake clock that simulates time exceeding 4ms after 2 nodes
      let callCount = 0;
      const fakeClock = () => {
        callCount++;
        // First call (start): 0ms
        // After 1st node: 1ms
        // After 2nd node: 2ms
        // After 3rd node: 5ms (exceeds 4ms budget)
        const times = [0, 1, 2, 5, 6, 7];
        return times[Math.min(callCount - 1, times.length - 1)];
      };

      const lod = new IncrementalLOD(lodProbe, perfProbe, fakeClock);
      const tree = makeTree('node-a');
      const layout = new Map([
        ['node-a', { x: 0, y: 0 }],
        ['node-b', { x: 1, y: 0 }],
        ['node-c', { x: 2, y: 0 }],
        ['node-d', { x: 3, y: 0 }],
        ['node-e', { x: 4, y: 0 }],
      ]);
      const zoomState = makeZoomState();
      const visibility = new Map([
        ['node-a', true],
        ['node-b', true],
        ['node-c', true],
        ['node-d', true],
        ['node-e', true],
      ]);

      lod.markAllDirty(['node-a', 'node-b', 'node-c', 'node-d', 'node-e']);
      const tiers = lod.computeFrame(tree, layout, zoomState, visibility);

      // Some nodes should have been processed, some deferred
      const processedIds = lodProbe.assignments.map(a => a.nodeId);
      expect(processedIds.length).toBeLessThan(5);
      expect(processedIds.length).toBeGreaterThan(0);

      // Deferred nodes should still be dirty (processable next frame)
      expect(lod.hasDirtyNodes()).toBe(true);
    });

    it('deferred nodes are processed in subsequent frames', () => {
      const lodProbe = new FakeLODProbe();
      const perfProbe = new FakePerformanceProbe();

      let callCount = 0;
      // First frame: budget exceeded after 2 nodes
      // Second frame: plenty of budget
      const fakeClock = () => {
        callCount++;
        if (callCount <= 6) {
          // First frame
          const times = [0, 1, 2, 5, 6, 7];
          return times[Math.min(callCount - 1, times.length - 1)];
        }
        // Second frame — plenty of time
        return 0;
      };

      const lod = new IncrementalLOD(lodProbe, perfProbe, fakeClock);
      const tree = makeTree('node-a');
      const layout = new Map([
        ['node-a', { x: 0, y: 0 }],
        ['node-b', { x: 1, y: 0 }],
        ['node-c', { x: 2, y: 0 }],
        ['node-d', { x: 3, y: 0 }],
      ]);
      const zoomState = makeZoomState();
      const visibility = new Map([
        ['node-a', true],
        ['node-b', true],
        ['node-c', true],
        ['node-d', true],
      ]);

      lod.markAllDirty(['node-a', 'node-b', 'node-c', 'node-d']);

      // First frame — some deferred
      lod.computeFrame(tree, layout, zoomState, visibility);
      const firstFrameCount = lodProbe.assignments.length;
      expect(firstFrameCount).toBeLessThan(4);

      // Second frame — deferred nodes processed
      lodProbe.assignments.length = 0;
      lod.computeFrame(tree, layout, zoomState, visibility);
      const totalProcessed = firstFrameCount + lodProbe.assignments.length;
      expect(totalProcessed).toBe(4);
    });

    it('reports lodComputationTime via performance probe', () => {
      const lodProbe = new FakeLODProbe();
      const perfProbe = new FakePerformanceProbe();

      let callCount = 0;
      const fakeClock = () => {
        callCount++;
        // Start: 0, end: 3
        return callCount === 1 ? 0 : 3;
      };

      const lod = new IncrementalLOD(lodProbe, perfProbe, fakeClock);
      const tree = makeTree('node-a');
      const layout = new Map([['node-a', { x: 0, y: 0 }]]);
      const zoomState = makeZoomState();
      const visibility = new Map([['node-a', true]]);

      lod.markAllDirty(['node-a']);
      lod.computeFrame(tree, layout, zoomState, visibility);

      expect(perfProbe.lodComputationTimeCalls.length).toBe(1);
      expect(perfProbe.lodComputationTimeCalls[0]).toBeGreaterThanOrEqual(0);
    });
  });

  describe('hysteresis', () => {
    it('applies hysteresis to non-focused visible nodes with a previous tier', () => {
      const lodProbe = new FakeLODProbe();
      const perfProbe = new FakePerformanceProbe();
      const lod = new IncrementalLOD(lodProbe, perfProbe);
      const tree = makeTree('other-node');
      // Single-node layout: nodeScreenWidth = viewportSize.width
      const layout = new Map([['node-a', { x: 0, y: 0 }]]);
      const visibility = new Map([['node-a', true]]);

      // First frame: screen width 85px → screenshot-low (naiveTier)
      const zs1 = makeZoomState({ viewportSize: { width: 85, height: 600 } });
      lod.markDirty('node-a');
      const tiers1 = lod.computeFrame(tree, layout, zs1, visibility);
      expect(tiers1.get('node-a')).toBe('screenshot-low');

      // Second frame: screen width 75px → still within hysteresis deadband
      // (exit threshold for screenshot-low is 60px, so 75px should stay)
      lodProbe.assignments.length = 0;
      lodProbe.transitions.length = 0;
      const zs2 = makeZoomState({ viewportSize: { width: 75, height: 600 } });
      lod.markDirty('node-a');
      const tiers2 = lod.computeFrame(tree, layout, zs2, visibility);
      expect(tiers2.get('node-a')).toBe('screenshot-low');
      // No transition should have been emitted — tier is stable
      expect(lodProbe.transitions).toHaveLength(0);
    });

    it('transitions when screen width crosses hysteresis exit threshold', () => {
      const lodProbe = new FakeLODProbe();
      const perfProbe = new FakePerformanceProbe();
      const lod = new IncrementalLOD(lodProbe, perfProbe);
      const tree = makeTree('other-node');
      const layout = new Map([['node-a', { x: 0, y: 0 }]]);
      const visibility = new Map([['node-a', true]]);

      // First frame: screen width 85px → screenshot-low
      const zs1 = makeZoomState({ viewportSize: { width: 85, height: 600 } });
      lod.markDirty('node-a');
      lod.computeFrame(tree, layout, zs1, visibility);

      // Second frame: screen width 59px → below exit threshold 60px → favicon
      lodProbe.assignments.length = 0;
      lodProbe.transitions.length = 0;
      const zs2 = makeZoomState({ viewportSize: { width: 59, height: 600 } });
      lod.markDirty('node-a');
      const tiers2 = lod.computeFrame(tree, layout, zs2, visibility);
      expect(tiers2.get('node-a')).toBe('favicon');
      expect(lodProbe.transitions).toContainEqual({
        nodeId: 'node-a',
        fromTier: 'screenshot-low',
        toTier: 'favicon',
      });
    });
  });

  describe('viewport exit dirtying', () => {
    it('nodes that leave the viewport entirely are marked dirty', () => {
      const lodProbe = new FakeLODProbe();
      const perfProbe = new FakePerformanceProbe();
      const lod = new IncrementalLOD(lodProbe, perfProbe);

      // Layout with two nodes: one at center, one far away
      const layout = new Map([
        ['center', { x: 0, y: 0 }],
        ['far-away', { x: 1000, y: 1000 }],
      ]);
      lod.syncIndex(layout);

      const tree = makeTree('center');
      // First viewport: center visible, far-away visible
      const zs1 = makeZoomState({
        focusPoint: { x: 500, y: 500 },
        viewportSize: { width: 100000, height: 100000 },
      });
      const vis1 = new Map([
        ['center', true],
        ['far-away', true],
      ]);
      lod.markAllDirty(['center', 'far-away']);
      lod.computeFrame(tree, layout, zs1, vis1);

      // Clear probes
      lodProbe.assignments.length = 0;
      lodProbe.transitions.length = 0;

      // Now pan far away so that 'far-away' was at center of old viewport
      // but is now far outside the new viewport
      const zs2 = makeZoomState({
        focusPoint: { x: 0, y: 0 },
        viewportSize: { width: 100, height: 100 },
      });
      lod.onViewportChange(zs2, layout);

      // 'far-away' should have been marked dirty since it left the viewport
      const vis2 = new Map([
        ['center', true],
        ['far-away', false],
      ]);
      const tiers = lod.computeFrame(tree, layout, zs2, vis2);

      // far-away should now be culled (was visible, now invisible + dirty)
      expect(tiers.get('far-away')).toBe('culled');
      // Verify the transition was emitted
      const farTransitions = lodProbe.transitions.filter(t => t.nodeId === 'far-away');
      expect(farTransitions.length).toBeGreaterThan(0);
      expect(farTransitions[farTransitions.length - 1].toTier).toBe('culled');
    });
  });

  describe('probe transition assertions', () => {
    it('emits tierTransitioned when a node changes tier', () => {
      const lodProbe = new FakeLODProbe();
      const perfProbe = new FakePerformanceProbe();
      const lod = new IncrementalLOD(lodProbe, perfProbe);
      const tree = makeTree('node-a');
      // Use small viewport so non-focused node gets favicon tier (< 80px)
      const layout = new Map([['node-a', { x: 0, y: 0 }]]);
      const visibility = new Map([['node-a', true]]);

      // First frame: node-a is focused → gets 'live' tier
      const zs1 = makeZoomState({ level: 0.5, viewportSize: { width: 50, height: 50 } });
      lod.markDirty('node-a');
      lod.computeFrame(tree, layout, zs1, visibility);
      expect(lodProbe.assignments[0]).toEqual({ nodeId: 'node-a', tier: 'live' });

      // Second frame: node-a loses focus → should transition from live to favicon
      lodProbe.assignments.length = 0;
      lodProbe.transitions.length = 0;
      const tree2 = makeTree('other-node');
      lod.markDirty('node-a');
      const tiers2 = lod.computeFrame(tree2, layout, zs1, visibility);

      // node-a was 'live' (focused) → with hysteresis, live demotes one
      // tier at a time: screenWidth 50 < 450 → screenshot-high (per §5.2)
      expect(tiers2.get('node-a')).toBe('screenshot-high');
      expect(lodProbe.transitions).toContainEqual({
        nodeId: 'node-a',
        fromTier: 'live',
        toTier: 'screenshot-high',
      });
    });

    it('does not emit tierTransitioned when tier stays the same', () => {
      const lodProbe = new FakeLODProbe();
      const perfProbe = new FakePerformanceProbe();
      const lod = new IncrementalLOD(lodProbe, perfProbe);
      const tree = makeTree('node-a');
      const layout = new Map([['node-a', { x: 0, y: 0 }]]);
      const visibility = new Map([['node-a', true]]);

      // First frame
      const zs = makeZoomState();
      lod.markDirty('node-a');
      lod.computeFrame(tree, layout, zs, visibility);

      // Second frame: same conditions → tier unchanged
      lodProbe.transitions.length = 0;
      lod.markDirty('node-a');
      lod.computeFrame(tree, layout, zs, visibility);

      expect(lodProbe.transitions).toHaveLength(0);
    });

    it('emits tierTransitioned for each node that changes in priority-ordered computation', () => {
      const lodProbe = new FakeLODProbe();
      const perfProbe = new FakePerformanceProbe();
      const lod = new IncrementalLOD(lodProbe, perfProbe);

      const tree: TreeShape = {
        focusedNodeId: 'focused',
        getAncestorIds: () => [],
        getSiblingIds: () => [],
        getDescendantIds: () => [],
      };

      const layout = new Map([
        ['focused', { x: 0, y: 0 }],
        ['other', { x: 1, y: 0 }],
      ]);

      // First frame: both visible
      const zs1 = makeZoomState({ level: 0.5 });
      const vis1 = new Map([['focused', true], ['other', true]]);
      lod.markAllDirty(['focused', 'other']);
      lod.computeFrame(tree, layout, zs1, vis1);

      // Second frame: 'other' becomes invisible → should transition to culled
      lodProbe.transitions.length = 0;
      lodProbe.assignments.length = 0;
      const vis2 = new Map([['focused', true], ['other', false]]);
      lod.markAllDirty(['focused', 'other']);
      const tiers2 = lod.computeFrame(tree, layout, zs1, vis2);

      expect(tiers2.get('other')).toBe('culled');
      expect(lodProbe.transitions).toContainEqual({
        nodeId: 'other',
        fromTier: expect.any(String),
        toTier: 'culled',
      });
    });
  });

  describe('NodePriority', () => {
    it('assigns correct priority levels', () => {
      expect(NodePriority.FOCUSED).toBe(0);
      expect(NodePriority.ANCESTOR).toBe(1);
      expect(NodePriority.SIBLING).toBe(2);
      expect(NodePriority.DESCENDANT).toBe(3);
      expect(NodePriority.DISTANT).toBe(4);
    });
  });
});
