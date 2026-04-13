import { describe, it, expect } from 'vitest';
import type { TreeNode } from './tree-node';
import type { ZoomState } from './zoom';
import { computeVisibility } from './culling';

function makeNode(id: string): TreeNode {
  return {
    id,
    url: `https://${id}.test`,
    title: '',
    favicon: null,
    parentId: null,
    childIds: [],
    status: 'culled',
    createdAt: 0,
    lastVisitedAt: 0,
    descendantCount: 0,
  };
}

function makeNodes(...ids: string[]): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>();
  for (const id of ids) {
    map.set(id, makeNode(id));
  }
  return map;
}

describe('computeVisibility', () => {
  it('node at viewport center is visible', () => {
    const nodes = makeNodes('a');
    const layout = new Map([['a', { x: 0, y: 0 }]]);
    // Single node: treeWidth = 1, ppu = viewportWidth at any level.
    // screenX = (0 - 0) * 1000 + 500 = 500 (center)
    const zoomState: ZoomState = {
      level: 0.5,
      focusPoint: { x: 0, y: 0 },
      viewportSize: { width: 1000, height: 800 },
    };

    const visibility = computeVisibility(nodes, layout, zoomState);
    expect(visibility.get('a')).toBe(true);
  });

  it('node far outside viewport is culled', () => {
    const nodes = makeNodes('a', 'b');
    const layout = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 1, y: 0 }],
    ]);
    // treeWidth = 2, level = 1 -> ppu = 1000
    // node b: screenX = (1 - 0) * 1000 + 500 = 1500 -> > 1200, culled
    const zoomState: ZoomState = {
      level: 1.0,
      focusPoint: { x: 0, y: 0 },
      viewportSize: { width: 1000, height: 800 },
    };

    const visibility = computeVisibility(nodes, layout, zoomState);
    expect(visibility.get('a')).toBe(true);
    expect(visibility.get('b')).toBe(false);
  });

  it('node within 200px margin of viewport edge is visible', () => {
    const nodes = makeNodes('a', 'b');
    const layout = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 1, y: 0 }],
    ]);
    // treeWidth = 2, level = 1 -> ppu = 1000
    // focusPoint = (0.65, 0):
    // node a: screenX = (0 - 0.65) * 1000 + 500 = -150 -> within [-200, 0] margin, visible
    const zoomState: ZoomState = {
      level: 1.0,
      focusPoint: { x: 0.65, y: 0 },
      viewportSize: { width: 1000, height: 800 },
    };

    const visibility = computeVisibility(nodes, layout, zoomState);
    expect(visibility.get('a')).toBe(true);
  });

  it('node just beyond 200px margin is culled', () => {
    const nodes = makeNodes('a', 'b');
    const layout = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 1, y: 0 }],
    ]);
    // treeWidth = 2, level = 1 -> ppu = 1000
    // focusPoint = (0.75, 0):
    // node a: screenX = (0 - 0.75) * 1000 + 500 = -250 -> beyond -200, culled
    const zoomState: ZoomState = {
      level: 1.0,
      focusPoint: { x: 0.75, y: 0 },
      viewportSize: { width: 1000, height: 800 },
    };

    const visibility = computeVisibility(nodes, layout, zoomState);
    expect(visibility.get('a')).toBe(false);
  });

  it('all nodes culled when tree is entirely outside viewport', () => {
    const nodes = makeNodes('a', 'b', 'c');
    const layout = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 1, y: 0 }],
      ['c', { x: 2, y: 0 }],
    ]);
    // treeWidth = 3, level = 0 -> ppu = 1000/3 ~ 333.3
    // focusPoint = (100, 0) -> all nodes far off-screen
    // node c (closest): screenX = (2 - 100) * 333.3 + 500 ~ -32163
    const zoomState: ZoomState = {
      level: 0,
      focusPoint: { x: 100, y: 0 },
      viewportSize: { width: 1000, height: 800 },
    };

    const visibility = computeVisibility(nodes, layout, zoomState);
    expect(visibility.get('a')).toBe(false);
    expect(visibility.get('b')).toBe(false);
    expect(visibility.get('c')).toBe(false);
  });

  it('all nodes visible when zoom is fully out and tree fits', () => {
    const nodes = makeNodes('a', 'b', 'c');
    const layout = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 1, y: 0 }],
      ['c', { x: 2, y: 0 }],
    ]);
    // treeWidth = 3, level = 0 -> ppu = 1000/3 ~ 333.3
    // focusPoint = (1, 0) -> center of tree
    // node a: screenX = (0-1)*333.3 + 500 = 166.7 -> visible
    // node b: screenX = 500 -> visible
    // node c: screenX = (2-1)*333.3 + 500 = 833.3 -> visible
    const zoomState: ZoomState = {
      level: 0,
      focusPoint: { x: 1, y: 0 },
      viewportSize: { width: 1000, height: 800 },
    };

    const visibility = computeVisibility(nodes, layout, zoomState);
    expect(visibility.get('a')).toBe(true);
    expect(visibility.get('b')).toBe(true);
    expect(visibility.get('c')).toBe(true);
  });
});
