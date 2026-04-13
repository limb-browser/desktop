import { describe, it, expect } from 'vitest';
import type { ZoomState } from './zoom';
import { clampZoomLevel, computeNodeScreenWidth } from './zoom';
import { BrowsingTree } from './browsing-tree';
import { FakeTreeProbe } from './__test-utils__/fake-tree-probe';
import { computeLayout } from './layout';

describe('clampZoomLevel', () => {
  it('clamps values below 0.0 to 0.0', () => {
    expect(clampZoomLevel(-0.5)).toBe(0);
    expect(clampZoomLevel(-100)).toBe(0);
  });

  it('clamps values above 1.0 to 1.0', () => {
    expect(clampZoomLevel(1.5)).toBe(1);
    expect(clampZoomLevel(100)).toBe(1);
  });

  it('preserves values within [0.0, 1.0]', () => {
    expect(clampZoomLevel(0)).toBe(0);
    expect(clampZoomLevel(0.5)).toBe(0.5);
    expect(clampZoomLevel(1)).toBe(1);
    expect(clampZoomLevel(0.3)).toBe(0.3);
  });
});

describe('ZoomState', () => {
  it('can be constructed with valid parameters', () => {
    const state: ZoomState = {
      level: 0.5,
      focusPoint: { x: 100, y: 200 },
      viewportSize: { width: 1920, height: 1080 },
    };

    expect(state.level).toBe(0.5);
    expect(state.focusPoint).toEqual({ x: 100, y: 200 });
    expect(state.viewportSize).toEqual({ width: 1920, height: 1080 });
  });
});

describe('computeNodeScreenWidth', () => {
  it('at level 1.0, focused node screen width equals viewport width', () => {
    const probe = new FakeTreeProbe();
    const tree = BrowsingTree.create('https://root.com', probe);
    tree.addChild(tree.rootId, 'https://a.com');
    tree.addChild(tree.rootId, 'https://b.com');

    const layout = computeLayout(tree);
    const focusedNode = tree.nodes.get(tree.focusedNodeId)!;

    const zoomState: ZoomState = {
      level: 1.0,
      focusPoint: layout.get(tree.focusedNodeId)!,
      viewportSize: { width: 1920, height: 1080 },
    };

    const width = computeNodeScreenWidth(focusedNode, zoomState, layout);
    expect(width).toBe(1920);
  });

  it('at level 0.0, all nodes fit within the viewport', () => {
    const probe = new FakeTreeProbe();
    const tree = BrowsingTree.create('https://root.com', probe);
    tree.addChild(tree.rootId, 'https://a.com');
    tree.addChild(tree.rootId, 'https://b.com');
    tree.addChild(tree.rootId, 'https://c.com');

    const layout = computeLayout(tree);

    const zoomState: ZoomState = {
      level: 0.0,
      focusPoint: layout.get(tree.focusedNodeId)!,
      viewportSize: { width: 1200, height: 800 },
    };

    // Tree has 3 leaves so rawTreeWidth = 3, but EFFECTIVE_MIN_TREE_WIDTH = 5.
    // At level 0, nodeScreenWidth = viewportWidth / effectiveTreeWidth
    // nodeScreenWidth * effectiveTreeWidth = viewportWidth
    const positions = [...layout.values()];
    const xs = positions.map(p => p.x);
    const rawTreeWidth = Math.max(...xs) - Math.min(...xs) + 1;
    const effectiveTreeWidth = Math.max(rawTreeWidth, 5); // EFFECTIVE_MIN_TREE_WIDTH

    const node = tree.nodes.get(tree.rootId)!;
    const nodeWidth = computeNodeScreenWidth(node, zoomState, layout);

    expect(nodeWidth * effectiveTreeWidth).toBeCloseTo(1200);
  });

  it('all nodes get equal screen width at a given zoom level, interpolated between level 0 and level 1', () => {
    const probe = new FakeTreeProbe();
    const tree = BrowsingTree.create('https://root.com', probe);
    const childA = tree.addChild(tree.rootId, 'https://a.com');
    const childB = tree.addChild(tree.rootId, 'https://b.com');
    const childC = tree.addChild(tree.rootId, 'https://c.com');

    const layout = computeLayout(tree);
    tree.focusNode(childA.id);

    const zoomState: ZoomState = {
      level: 0.5,
      focusPoint: layout.get(childA.id)!,
      viewportSize: { width: 1920, height: 1080 },
    };

    // All nodes get the same proportional screen width at a given zoom level
    const widthA = computeNodeScreenWidth(tree.nodes.get(childA.id)!, zoomState, layout);
    const widthB = computeNodeScreenWidth(tree.nodes.get(childB.id)!, zoomState, layout);
    const widthC = computeNodeScreenWidth(tree.nodes.get(childC.id)!, zoomState, layout);

    expect(widthA).toBe(widthB);
    expect(widthB).toBe(widthC);

    // Width at intermediate level is between level 0 and level 1
    const zoomAt0: ZoomState = { ...zoomState, level: 0.0 };
    const zoomAt1: ZoomState = { ...zoomState, level: 1.0 };
    const widthAt0 = computeNodeScreenWidth(tree.nodes.get(childA.id)!, zoomAt0, layout);
    const widthAt1 = computeNodeScreenWidth(tree.nodes.get(childA.id)!, zoomAt1, layout);

    expect(widthA).toBeGreaterThan(widthAt0);
    expect(widthA).toBeLessThan(widthAt1);
  });

  it('single node tree: node fills viewport at level 1.0 and zooms correctly', () => {
    const probe = new FakeTreeProbe();
    const tree = BrowsingTree.create('https://root.com', probe);
    const layout = computeLayout(tree);
    const node = tree.nodes.get(tree.rootId)!;

    // At level 1.0, the node always fills the viewport regardless of EFFECTIVE_MIN_TREE_WIDTH
    const zoomState1: ZoomState = {
      level: 1.0,
      focusPoint: layout.get(tree.rootId)!,
      viewportSize: { width: 1920, height: 1080 },
    };
    expect(computeNodeScreenWidth(node, zoomState1, layout)).toBe(1920);

    // At level 0.0, the node is viewportWidth / EFFECTIVE_MIN_TREE_WIDTH
    const zoomState0: ZoomState = {
      level: 0.0,
      focusPoint: layout.get(tree.rootId)!,
      viewportSize: { width: 1920, height: 1080 },
    };
    expect(computeNodeScreenWidth(node, zoomState0, layout)).toBeCloseTo(1920 / 5);

    // At intermediate levels, the node screen width is between the two extremes
    const zoomState05: ZoomState = {
      level: 0.5,
      focusPoint: layout.get(tree.rootId)!,
      viewportSize: { width: 1920, height: 1080 },
    };
    const mid = computeNodeScreenWidth(node, zoomState05, layout);
    expect(mid).toBeGreaterThan(1920 / 5);
    expect(mid).toBeLessThan(1920);
  });
});
