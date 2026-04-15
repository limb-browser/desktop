// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { TreeRenderer } from './TreeRenderer.mjs';
import type { NodePosition } from './TreeLayout';

const BASE_NODE_WIDTH = 0.8;
const BASE_NODE_HEIGHT = 0.6;

function createRenderer(overrides?: {
  baseNodeWidth?: number;
  baseNodeHeight?: number;
}): TreeRenderer {
  return new TreeRenderer(
    overrides?.baseNodeWidth ?? BASE_NODE_WIDTH,
    overrides?.baseNodeHeight ?? BASE_NODE_HEIGHT,
  );
}

// Simple viewport transform: focusPoint at origin, scale = 100px/unit, viewport 1000x800
function simpleTransform() {
  return {
    zoomScale: 100,
    viewportWidth: 1000,
    viewportHeight: 800,
    toScreen: (lx: number, ly: number) => ({
      x: lx * 100 + 500,
      y: ly * 100 + 400,
    }),
  };
}

describe('TreeRenderer', () => {
  describe('node rectangles at correct screen positions', () => {
    it('computes a node rect centered at the screen position of its logical coordinates', () => {
      const renderer = createRenderer();
      const positions = new Map<string, NodePosition>([
        ['root', { x: 0, y: 0 }],
      ]);
      const parentMap = new Map<string, string>();
      const t = simpleTransform();

      const frame = renderer.computeFrame(
        positions,
        parentMap,
        t.toScreen,
        t.zoomScale,
        t.viewportWidth,
        t.viewportHeight,
      );

      expect(frame.nodes).toHaveLength(1);
      const node = frame.nodes[0];
      // Logical (0,0) -> screen (500, 400). Node width = 0.8 * 100 = 80, height = 0.6 * 100 = 60
      expect(node.nodeId).toBe('root');
      expect(node.x).toBe(500 - 40); // centered
      expect(node.y).toBe(400 - 30);
      expect(node.width).toBe(80);
      expect(node.height).toBe(60);
    });

    it('places multiple nodes at their respective screen positions', () => {
      const renderer = createRenderer();
      const positions = new Map<string, NodePosition>([
        ['root', { x: 1, y: 0 }],
        ['child1', { x: 0, y: 1 }],
        ['child2', { x: 2, y: 1 }],
      ]);
      const parentMap = new Map<string, string>([
        ['child1', 'root'],
        ['child2', 'root'],
      ]);
      const t = simpleTransform();

      const frame = renderer.computeFrame(
        positions,
        parentMap,
        t.toScreen,
        t.zoomScale,
        t.viewportWidth,
        t.viewportHeight,
      );

      const nodeById = new Map(frame.nodes.map((n) => [n.nodeId, n]));
      expect(nodeById.size).toBe(3);

      // root at logical (1,0) -> screen (600, 400)
      const root = nodeById.get('root')!;
      expect(root.x).toBe(600 - 40);
      expect(root.y).toBe(400 - 30);

      // child1 at logical (0,1) -> screen (500, 500)
      const c1 = nodeById.get('child1')!;
      expect(c1.x).toBe(500 - 40);
      expect(c1.y).toBe(500 - 30);

      // child2 at logical (2,1) -> screen (700, 500)
      const c2 = nodeById.get('child2')!;
      expect(c2.x).toBe(700 - 40);
      expect(c2.y).toBe(500 - 30);
    });

    it('scales node size with zoom', () => {
      const renderer = createRenderer();
      const positions = new Map<string, NodePosition>([
        ['n', { x: 0, y: 0 }],
      ]);
      const parentMap = new Map<string, string>();

      // zoom scale = 200
      const frame = renderer.computeFrame(
        positions,
        parentMap,
        (lx, ly) => ({ x: lx * 200 + 500, y: ly * 200 + 400 }),
        200,
        1000,
        800,
      );

      expect(frame.nodes[0].width).toBe(0.8 * 200);
      expect(frame.nodes[0].height).toBe(0.6 * 200);
    });
  });

  describe('edges connect correct parent-child pairs', () => {
    it('draws an edge from parent bottom-center to child top-center', () => {
      const renderer = createRenderer();
      const positions = new Map<string, NodePosition>([
        ['root', { x: 0, y: 0 }],
        ['child', { x: 0, y: 1 }],
      ]);
      const parentMap = new Map([['child', 'root']]);
      const t = simpleTransform();

      const frame = renderer.computeFrame(
        positions,
        parentMap,
        t.toScreen,
        t.zoomScale,
        t.viewportWidth,
        t.viewportHeight,
      );

      expect(frame.edges).toHaveLength(1);
      const edge = frame.edges[0];
      expect(edge.parentId).toBe('root');
      expect(edge.childId).toBe('child');

      // Parent at screen (500, 400), node height 60 -> bottom-center = (500, 430)
      expect(edge.startX).toBe(500);
      expect(edge.startY).toBe(400 + 30);

      // Child at screen (500, 500), node height 60 -> top-center = (500, 470)
      expect(edge.endX).toBe(500);
      expect(edge.endY).toBe(500 - 30);
    });

    it('draws edges for all parent-child pairs', () => {
      const renderer = createRenderer();
      const positions = new Map<string, NodePosition>([
        ['root', { x: 1, y: 0 }],
        ['a', { x: 0, y: 1 }],
        ['b', { x: 2, y: 1 }],
        ['a1', { x: 0, y: 2 }],
      ]);
      const parentMap = new Map([
        ['a', 'root'],
        ['b', 'root'],
        ['a1', 'a'],
      ]);
      const t = simpleTransform();

      const frame = renderer.computeFrame(
        positions,
        parentMap,
        t.toScreen,
        t.zoomScale,
        t.viewportWidth,
        t.viewportHeight,
      );

      expect(frame.edges).toHaveLength(3);
      const edgePairs = frame.edges.map((e) => `${e.parentId}->${e.childId}`);
      expect(edgePairs).toContain('root->a');
      expect(edgePairs).toContain('root->b');
      expect(edgePairs).toContain('a->a1');
    });

    it('edge start is at parent bottom-center horizontally', () => {
      const renderer = createRenderer();
      const positions = new Map<string, NodePosition>([
        ['parent', { x: 3, y: 0 }],
        ['child', { x: 5, y: 1 }],
      ]);
      const parentMap = new Map([['child', 'parent']]);
      const t = simpleTransform();

      const frame = renderer.computeFrame(
        positions,
        parentMap,
        t.toScreen,
        t.zoomScale,
        t.viewportWidth,
        t.viewportHeight,
      );

      const edge = frame.edges[0];
      // Parent screen center = (3*100+500, 0*100+400) = (800, 400)
      expect(edge.startX).toBe(800);
      expect(edge.startY).toBe(400 + 30); // bottom-center

      // Child screen center = (5*100+500, 1*100+400) = (1000, 500)
      expect(edge.endX).toBe(1000);
      expect(edge.endY).toBe(500 - 30); // top-center
    });
  });

  describe('off-screen nodes are not painted', () => {
    it('excludes a node entirely to the right of the viewport', () => {
      const renderer = createRenderer();
      // Node at logical (100, 0) -> screen (100*100+500, 400) = (10500, 400) -- way off right
      const positions = new Map<string, NodePosition>([
        ['onscreen', { x: 0, y: 0 }],
        ['offscreen', { x: 100, y: 0 }],
      ]);
      const parentMap = new Map<string, string>();
      const t = simpleTransform();

      const frame = renderer.computeFrame(
        positions,
        parentMap,
        t.toScreen,
        t.zoomScale,
        t.viewportWidth,
        t.viewportHeight,
      );

      const nodeIds = frame.nodes.map((n) => n.nodeId);
      expect(nodeIds).toContain('onscreen');
      expect(nodeIds).not.toContain('offscreen');
    });

    it('excludes a node entirely below the viewport', () => {
      const renderer = createRenderer();
      // Node at logical (0, 100) -> screen (500, 100*100+400) = (500, 10400) -- way below
      const positions = new Map<string, NodePosition>([
        ['onscreen', { x: 0, y: 0 }],
        ['offscreen', { x: 0, y: 100 }],
      ]);
      const parentMap = new Map<string, string>();
      const t = simpleTransform();

      const frame = renderer.computeFrame(
        positions,
        parentMap,
        t.toScreen,
        t.zoomScale,
        t.viewportWidth,
        t.viewportHeight,
      );

      const nodeIds = frame.nodes.map((n) => n.nodeId);
      expect(nodeIds).toContain('onscreen');
      expect(nodeIds).not.toContain('offscreen');
    });

    it('excludes a node entirely to the left of the viewport', () => {
      const renderer = createRenderer();
      // Node at logical (-20, 0) -> screen (-20*100+500, 400) = (-1500, 400) -- off left
      const positions = new Map<string, NodePosition>([
        ['onscreen', { x: 0, y: 0 }],
        ['offscreen', { x: -20, y: 0 }],
      ]);
      const parentMap = new Map<string, string>();
      const t = simpleTransform();

      const frame = renderer.computeFrame(
        positions,
        parentMap,
        t.toScreen,
        t.zoomScale,
        t.viewportWidth,
        t.viewportHeight,
      );

      const nodeIds = frame.nodes.map((n) => n.nodeId);
      expect(nodeIds).toContain('onscreen');
      expect(nodeIds).not.toContain('offscreen');
    });

    it('excludes a node entirely above the viewport', () => {
      const renderer = createRenderer();
      // Node at logical (0, -20) -> screen (500, -20*100+400) = (500, -1600) -- off top
      const positions = new Map<string, NodePosition>([
        ['onscreen', { x: 0, y: 0 }],
        ['offscreen', { x: 0, y: -20 }],
      ]);
      const parentMap = new Map<string, string>();
      const t = simpleTransform();

      const frame = renderer.computeFrame(
        positions,
        parentMap,
        t.toScreen,
        t.zoomScale,
        t.viewportWidth,
        t.viewportHeight,
      );

      const nodeIds = frame.nodes.map((n) => n.nodeId);
      expect(nodeIds).toContain('onscreen');
      expect(nodeIds).not.toContain('offscreen');
    });

    it('includes a node partially overlapping the viewport edge', () => {
      const renderer = createRenderer();
      // Node at logical (4.5, 0) -> screen (4.5*100+500, 400) = (950, 400)
      // Node rect: x=950-40=910 to x=950+40=990, within viewport width=1000
      const positions = new Map<string, NodePosition>([
        ['partial', { x: 4.5, y: 0 }],
      ]);
      const parentMap = new Map<string, string>();
      const t = simpleTransform();

      const frame = renderer.computeFrame(
        positions,
        parentMap,
        t.toScreen,
        t.zoomScale,
        t.viewportWidth,
        t.viewportHeight,
      );

      expect(frame.nodes).toHaveLength(1);
      expect(frame.nodes[0].nodeId).toBe('partial');
    });

    it('excludes edges when both parent and child are off-screen', () => {
      const renderer = createRenderer();
      const positions = new Map<string, NodePosition>([
        ['onscreen', { x: 0, y: 0 }],
        ['offP', { x: 100, y: 0 }],
        ['offC', { x: 100, y: 1 }],
      ]);
      const parentMap = new Map([
        ['offC', 'offP'],
      ]);
      const t = simpleTransform();

      const frame = renderer.computeFrame(
        positions,
        parentMap,
        t.toScreen,
        t.zoomScale,
        t.viewportWidth,
        t.viewportHeight,
      );

      expect(frame.edges).toHaveLength(0);
    });

    it('includes edges when at least one endpoint is on-screen', () => {
      const renderer = createRenderer();
      // parent on screen, child off screen
      const positions = new Map<string, NodePosition>([
        ['parent', { x: 0, y: 0 }],
        ['child', { x: 100, y: 1 }],
      ]);
      const parentMap = new Map([['child', 'parent']]);
      const t = simpleTransform();

      const frame = renderer.computeFrame(
        positions,
        parentMap,
        t.toScreen,
        t.zoomScale,
        t.viewportWidth,
        t.viewportHeight,
      );

      expect(frame.edges).toHaveLength(1);
    });
  });

  describe('focus ring', () => {
    it('returns focus ring rect for the focused visible node', () => {
      const renderer = createRenderer();
      const positions = new Map<string, NodePosition>([
        ['root', { x: 0, y: 0 }],
        ['child', { x: 1, y: 1 }],
      ]);
      const parentMap = new Map([['child', 'root']]);
      const t = simpleTransform();

      const frame = renderer.computeFrame(
        positions,
        parentMap,
        t.toScreen,
        t.zoomScale,
        t.viewportWidth,
        t.viewportHeight,
        'child',
      );

      expect(frame.focusRing).not.toBeNull();
      expect(frame.focusRing!.nodeId).toBe('child');
      // Should match the child's node rect
      const childNode = frame.nodes.find((n) => n.nodeId === 'child')!;
      expect(frame.focusRing!.x).toBe(childNode.x);
      expect(frame.focusRing!.y).toBe(childNode.y);
      expect(frame.focusRing!.width).toBe(childNode.width);
      expect(frame.focusRing!.height).toBe(childNode.height);
    });

    it('returns null focus ring when focused node is off-screen', () => {
      const renderer = createRenderer();
      const positions = new Map<string, NodePosition>([
        ['root', { x: 0, y: 0 }],
        ['child', { x: 100, y: 0 }],
      ]);
      const parentMap = new Map([['child', 'root']]);
      const t = simpleTransform();

      const frame = renderer.computeFrame(
        positions,
        parentMap,
        t.toScreen,
        t.zoomScale,
        t.viewportWidth,
        t.viewportHeight,
        'child',
      );

      expect(frame.focusRing).toBeNull();
    });

    it('returns null focus ring when no focused node specified', () => {
      const renderer = createRenderer();
      const positions = new Map<string, NodePosition>([
        ['root', { x: 0, y: 0 }],
      ]);
      const parentMap = new Map<string, string>();
      const t = simpleTransform();

      const frame = renderer.computeFrame(
        positions,
        parentMap,
        t.toScreen,
        t.zoomScale,
        t.viewportWidth,
        t.viewportHeight,
      );

      expect(frame.focusRing).toBeNull();
    });
  });
});
