// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { LODComputer } from './LODComputer.mjs';
import type { LODProbe } from '../ports/LODProbe';

const BASE_NODE_WIDTH = 0.8;
const BASE_NODE_HEIGHT = 0.6;

function createFakeProbe(): LODProbe & {
  calls: { nodeId: string; previousTier: string; newTier: string }[];
} {
  const calls: { nodeId: string; previousTier: string; newTier: string }[] = [];
  return {
    calls,
    tierChanged(nodeId: string, previousTier: string, newTier: string) {
      calls.push({ nodeId, previousTier, newTier });
    },
  };
}

/**
 * Create a fake ZoomState-like object with precise control over zoomScale
 * and viewport behavior.
 *
 * nodeScreenWidth = baseNodeWidth * zoomScale, so:
 *   zoomScale =  80 / 0.8 = 100  -> nodeScreenWidth =  80
 *   zoomScale = 300 / 0.8 = 375  -> nodeScreenWidth = 300
 *   zoomScale = 600 / 0.8 = 750  -> nodeScreenWidth = 600
 */
function createFakeZoomState(opts: {
  zoomScale: number;
  level?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  focusX?: number;
  focusY?: number;
}) {
  const vpW = opts.viewportWidth ?? 1000;
  const vpH = opts.viewportHeight ?? 800;
  const fx = opts.focusX ?? 0;
  const fy = opts.focusY ?? 0;
  return {
    get zoomScale() {
      return opts.zoomScale;
    },
    get level() {
      return opts.level ?? 0.5;
    },
    viewportSize: { width: vpW, height: vpH },
    logicalToScreen(x: number, y: number) {
      return {
        x: (x - fx) * opts.zoomScale + vpW / 2,
        y: (y - fy) * opts.zoomScale + vpH / 2,
      };
    },
  };
}

function createFakeTree(focusedNodeId: string) {
  return { focusedNodeId };
}

function scaleForWidth(targetWidth: number): number {
  return targetWidth / BASE_NODE_WIDTH;
}

/**
 * Run computeTiers repeatedly until the tier for every node stabilizes,
 * up to maxFrames. Returns the final tier map. This simulates the monotonic
 * ramp-up from initial culled state to steady-state.
 */
function stabilize(
  computer: LODComputer,
  tree: { focusedNodeId: string },
  positions: Map<string, { x: number; y: number }>,
  zoom: ReturnType<typeof createFakeZoomState>,
  maxFrames = 10,
): Map<string, string> {
  let tiers = computer.computeTiers(tree, positions, zoom);
  for (let i = 1; i < maxFrames; i++) {
    const next = computer.computeTiers(tree, positions, zoom);
    let changed = false;
    for (const [nodeId, tier] of next) {
      if (tier !== tiers.get(nodeId)) {
        changed = true;
        break;
      }
    }
    tiers = next;
    if (!changed) break;
  }
  return tiers;
}

describe('LODComputer', () => {
  let computer: LODComputer;
  let probe: ReturnType<typeof createFakeProbe>;

  beforeEach(() => {
    probe = createFakeProbe();
    computer = new LODComputer(BASE_NODE_WIDTH, BASE_NODE_HEIGHT, probe);
  });

  describe('tier assignment at each threshold boundary', () => {
    it('assigns favicon tier when nodeScreenWidth < 80', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');
      const zoom = createFakeZoomState({ zoomScale: scaleForWidth(79) });

      const tiers = stabilize(computer, tree, positions, zoom);

      expect(tiers.get('n1')).toBe('favicon');
    });

    it('assigns screenshot-low tier at exactly 80px', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');
      const zoom = createFakeZoomState({ zoomScale: scaleForWidth(80) });

      const tiers = stabilize(computer, tree, positions, zoom);

      expect(tiers.get('n1')).toBe('screenshot-low');
    });

    it('assigns screenshot-low tier at 299px', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');
      const zoom = createFakeZoomState({ zoomScale: scaleForWidth(299) });

      const tiers = stabilize(computer, tree, positions, zoom);

      expect(tiers.get('n1')).toBe('screenshot-low');
    });

    it('assigns screenshot-high tier at exactly 300px', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');
      const zoom = createFakeZoomState({ zoomScale: scaleForWidth(300) });

      const tiers = stabilize(computer, tree, positions, zoom);

      expect(tiers.get('n1')).toBe('screenshot-high');
    });

    it('assigns screenshot-high tier at 599px', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');
      const zoom = createFakeZoomState({ zoomScale: scaleForWidth(599) });

      const tiers = stabilize(computer, tree, positions, zoom);

      expect(tiers.get('n1')).toBe('screenshot-high');
    });

    it('assigns live tier at exactly 600px', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');
      const zoom = createFakeZoomState({ zoomScale: scaleForWidth(600) });

      const tiers = stabilize(computer, tree, positions, zoom);

      expect(tiers.get('n1')).toBe('live');
    });

    it('assigns live tier at very large width', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');
      const zoom = createFakeZoomState({ zoomScale: scaleForWidth(2000) });

      const tiers = stabilize(computer, tree, positions, zoom);

      expect(tiers.get('n1')).toBe('live');
    });

    it('assigns focused tier when focusedNodeId and level >= 0.9', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('n1');
      const zoom = createFakeZoomState({
        zoomScale: scaleForWidth(600),
        level: 0.95,
      });

      const tiers = computer.computeTiers(tree, positions, zoom);

      expect(tiers.get('n1')).toBe('focused');
    });

    it('assigns focused tier at exactly level 0.9', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('n1');
      const zoom = createFakeZoomState({
        zoomScale: scaleForWidth(100),
        level: 0.9,
      });

      const tiers = computer.computeTiers(tree, positions, zoom);

      expect(tiers.get('n1')).toBe('focused');
    });

    it('assigns every visible node a tier (no undefined)', () => {
      const positions = new Map([
        ['n1', { x: 0, y: 0 }],
        ['n2', { x: 1, y: 0 }],
        ['n3', { x: 2, y: 0 }],
      ]);
      const tree = createFakeTree('n1');
      const zoom = createFakeZoomState({ zoomScale: scaleForWidth(200) });

      const tiers = computer.computeTiers(tree, positions, zoom);

      for (const [nodeId] of positions) {
        expect(tiers.get(nodeId)).toBeDefined();
      }
    });
  });

  describe('hysteresis prevents thrashing at boundaries', () => {
    it('screenshot-low stays at screenshot-low when width drops to 70px (above exit 60px)', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');

      // Ramp up to screenshot-low (culled -> favicon -> screenshot-low)
      stabilize(computer, tree, positions, createFakeZoomState({ zoomScale: scaleForWidth(80) }));

      // Drop to 70px (between exit 60 and enter 80)
      const tiers = computer.computeTiers(
        tree,
        positions,
        createFakeZoomState({ zoomScale: scaleForWidth(70) }),
      );

      expect(tiers.get('n1')).toBe('screenshot-low');
    });

    it('screenshot-low demotes to favicon when width drops below 60px', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');

      // Ramp up to screenshot-low
      stabilize(computer, tree, positions, createFakeZoomState({ zoomScale: scaleForWidth(80) }));

      // Drop to 59px (below exit 60)
      const tiers = computer.computeTiers(
        tree,
        positions,
        createFakeZoomState({ zoomScale: scaleForWidth(59) }),
      );

      expect(tiers.get('n1')).toBe('favicon');
    });

    it('screenshot-low stays at 60px (exit requires strict < 60)', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');

      // Ramp up to screenshot-low
      stabilize(computer, tree, positions, createFakeZoomState({ zoomScale: scaleForWidth(80) }));

      // Exactly at exit boundary
      const tiers = computer.computeTiers(
        tree,
        positions,
        createFakeZoomState({ zoomScale: scaleForWidth(60) }),
      );

      expect(tiers.get('n1')).toBe('screenshot-low');
    });

    it('screenshot-high stays when width drops to 260px (above exit 250px)', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');

      // Ramp up to screenshot-high
      stabilize(computer, tree, positions, createFakeZoomState({ zoomScale: scaleForWidth(300) }));

      // Drop to 260px (between exit 250 and enter 300)
      const tiers = computer.computeTiers(
        tree,
        positions,
        createFakeZoomState({ zoomScale: scaleForWidth(260) }),
      );

      expect(tiers.get('n1')).toBe('screenshot-high');
    });

    it('screenshot-high demotes to screenshot-low when width drops below 250px', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');

      // Ramp up to screenshot-high
      stabilize(computer, tree, positions, createFakeZoomState({ zoomScale: scaleForWidth(300) }));

      // Drop below exit threshold
      const tiers = computer.computeTiers(
        tree,
        positions,
        createFakeZoomState({ zoomScale: scaleForWidth(249) }),
      );

      expect(tiers.get('n1')).toBe('screenshot-low');
    });

    it('screenshot-high stays at 250px (exit requires strict < 250)', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');

      // Ramp up to screenshot-high
      stabilize(computer, tree, positions, createFakeZoomState({ zoomScale: scaleForWidth(300) }));

      // Exactly at exit boundary
      const tiers = computer.computeTiers(
        tree,
        positions,
        createFakeZoomState({ zoomScale: scaleForWidth(250) }),
      );

      expect(tiers.get('n1')).toBe('screenshot-high');
    });

    it('live stays when width drops to 500px (above exit 450px)', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');

      // Ramp up to live
      stabilize(computer, tree, positions, createFakeZoomState({ zoomScale: scaleForWidth(600) }));

      // Drop to 500px (between exit 450 and enter 600)
      const tiers = computer.computeTiers(
        tree,
        positions,
        createFakeZoomState({ zoomScale: scaleForWidth(500) }),
      );

      expect(tiers.get('n1')).toBe('live');
    });

    it('live demotes to screenshot-high when width drops below 450px', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');

      // Ramp up to live
      stabilize(computer, tree, positions, createFakeZoomState({ zoomScale: scaleForWidth(600) }));

      // Drop below exit threshold
      const tiers = computer.computeTiers(
        tree,
        positions,
        createFakeZoomState({ zoomScale: scaleForWidth(449) }),
      );

      expect(tiers.get('n1')).toBe('screenshot-high');
    });

    it('live stays at 450px (exit requires strict < 450)', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');

      // Ramp up to live
      stabilize(computer, tree, positions, createFakeZoomState({ zoomScale: scaleForWidth(600) }));

      // Exactly at exit boundary
      const tiers = computer.computeTiers(
        tree,
        positions,
        createFakeZoomState({ zoomScale: scaleForWidth(450) }),
      );

      expect(tiers.get('n1')).toBe('live');
    });

    it('does not promote from favicon to screenshot-low when below enter threshold', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');

      // First frame: favicon at 50px
      computer.computeTiers(tree, positions, createFakeZoomState({ zoomScale: scaleForWidth(50) }));

      // Second frame: still at 79px (below enter 80)
      const tiers = computer.computeTiers(
        tree,
        positions,
        createFakeZoomState({ zoomScale: scaleForWidth(79) }),
      );

      expect(tiers.get('n1')).toBe('favicon');
    });
  });

  describe('focused node never drops below Live', () => {
    it('focused node is live even at small nodeScreenWidth', () => {
      const positions = new Map([['focus', { x: 0, y: 0 }]]);
      const tree = createFakeTree('focus');
      const zoom = createFakeZoomState({
        zoomScale: scaleForWidth(20),
        level: 0.5,
      });

      const tiers = computer.computeTiers(tree, positions, zoom);

      expect(tiers.get('focus')).toBe('live');
    });

    it('focused node is live at level < 0.9', () => {
      const positions = new Map([['focus', { x: 0, y: 0 }]]);
      const tree = createFakeTree('focus');
      const zoom = createFakeZoomState({
        zoomScale: scaleForWidth(600),
        level: 0.89,
      });

      const tiers = computer.computeTiers(tree, positions, zoom);

      expect(tiers.get('focus')).toBe('live');
    });

    it('focused node is focused at level >= 0.9', () => {
      const positions = new Map([['focus', { x: 0, y: 0 }]]);
      const tree = createFakeTree('focus');
      const zoom = createFakeZoomState({
        zoomScale: scaleForWidth(600),
        level: 0.9,
      });

      const tiers = computer.computeTiers(tree, positions, zoom);

      expect(tiers.get('focus')).toBe('focused');
    });

    it('focused node jumps directly to live (exempt from monotonic)', () => {
      const positions = new Map([['focus', { x: 0, y: 0 }]]);

      // First frame: not focused, gets favicon
      const tree1 = createFakeTree('other');
      const zoom1 = createFakeZoomState({ zoomScale: scaleForWidth(50) });
      computer.computeTiers(tree1, positions, zoom1);

      // Second frame: becomes focused, should jump directly to live
      const tree2 = createFakeTree('focus');
      const zoom2 = createFakeZoomState({
        zoomScale: scaleForWidth(50),
        level: 0.5,
      });
      const tiers = computer.computeTiers(tree2, positions, zoom2);

      expect(tiers.get('focus')).toBe('live');
    });

    it('focused node overrides culled status', () => {
      // Focused node off-screen still gets live (not culled)
      const positions = new Map([['focus', { x: 100, y: 0 }]]);
      const tree = createFakeTree('focus');
      const zoom = createFakeZoomState({
        zoomScale: scaleForWidth(50),
        level: 0.5,
        viewportWidth: 200,
        viewportHeight: 200,
      });

      const tiers = computer.computeTiers(tree, positions, zoom);

      expect(tiers.get('focus')).toBe('live');
    });
  });

  describe('monotonic transitions', () => {
    it('non-focused node steps up one tier per frame from culled', () => {
      // Node starts culled, then becomes visible at live-level width
      // Should step up one tier per frame: culled -> favicon -> screenshot-low -> ...
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');
      const zoom = createFakeZoomState({ zoomScale: scaleForWidth(700) });

      // Frame 1: first computation, starts at culled, steps to favicon
      const tiers1 = computer.computeTiers(tree, positions, zoom);
      expect(tiers1.get('n1')).toBe('favicon');

      // Frame 2: favicon -> screenshot-low
      const tiers2 = computer.computeTiers(tree, positions, zoom);
      expect(tiers2.get('n1')).toBe('screenshot-low');

      // Frame 3: screenshot-low -> screenshot-high
      const tiers3 = computer.computeTiers(tree, positions, zoom);
      expect(tiers3.get('n1')).toBe('screenshot-high');

      // Frame 4: screenshot-high -> live
      const tiers4 = computer.computeTiers(tree, positions, zoom);
      expect(tiers4.get('n1')).toBe('live');
    });

    it('non-focused node steps down one tier per frame', () => {
      // Ramp up to live
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');

      stabilize(computer, tree, positions, createFakeZoomState({ zoomScale: scaleForWidth(600) }));

      // Now drop to favicon-level width: should step down one tier per frame
      const zoomSmall = createFakeZoomState({ zoomScale: scaleForWidth(30) });

      // live -> screenshot-high (exit threshold 450, 30 < 450)
      const tiers1 = computer.computeTiers(tree, positions, zoomSmall);
      expect(tiers1.get('n1')).toBe('screenshot-high');

      // screenshot-high -> screenshot-low (exit threshold 250, 30 < 250)
      const tiers2 = computer.computeTiers(tree, positions, zoomSmall);
      expect(tiers2.get('n1')).toBe('screenshot-low');

      // screenshot-low -> favicon (exit threshold 60, 30 < 60)
      const tiers3 = computer.computeTiers(tree, positions, zoomSmall);
      expect(tiers3.get('n1')).toBe('favicon');

      // favicon stays (lowest visible tier)
      const tiers4 = computer.computeTiers(tree, positions, zoomSmall);
      expect(tiers4.get('n1')).toBe('favicon');
    });

    it('non-focused node does not skip tiers when promoting', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');

      // Start at favicon
      computer.computeTiers(
        tree,
        positions,
        createFakeZoomState({ zoomScale: scaleForWidth(50) }),
      );

      // Jump to live-level width - should only step up one tier
      const tiers = computer.computeTiers(
        tree,
        positions,
        createFakeZoomState({ zoomScale: scaleForWidth(700) }),
      );

      expect(tiers.get('n1')).toBe('screenshot-low');
    });

    it('non-focused node does not skip tiers when demoting', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');

      // Ramp up to screenshot-high
      stabilize(computer, tree, positions, createFakeZoomState({ zoomScale: scaleForWidth(300) }));

      // Drop to favicon-level width - should only step down one tier
      const tiers = computer.computeTiers(
        tree,
        positions,
        createFakeZoomState({ zoomScale: scaleForWidth(30) }),
      );

      expect(tiers.get('n1')).toBe('screenshot-low');
    });
  });

  describe('culling margin', () => {
    it('culls a node fully outside viewport + 200px margin', () => {
      // Node placed far off-screen to the right
      const positions = new Map([['n1', { x: 50, y: 0 }]]);
      const tree = createFakeTree('other');
      const zoom = createFakeZoomState({
        zoomScale: scaleForWidth(100),
        viewportWidth: 1000,
        viewportHeight: 800,
      });
      // Screen x = (50 - 0) * 125 + 500 = 6750. Node half-width = 50.
      // rectLeft = 6700, which is > 1000 + 200 = 1200. Culled.

      const tiers = computer.computeTiers(tree, positions, zoom);

      expect(tiers.get('n1')).toBe('culled');
    });

    it('does not cull a node within 200px of viewport edge', () => {
      // Node just outside viewport but within 200px margin
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');
      // Place node so its right edge is just past viewport but within margin
      // viewport = 1000px. Node at screen x such that rectLeft > 1000 but < 1200
      // Using focusX to shift: screen_x = (0 - fx) * scale + 500
      // Want rectLeft = screen_x - halfW > 1000 and < 1200
      // halfW = nodeScreenWidth/2 = 100/2 = 50
      // so screen_x > 1050 and screen_x < 1250
      // screen_x = -fx * 125 + 500. Let fx = -5.
      // screen_x = 5 * 125 + 500 = 1125. rectLeft = 1075. 1000 < 1075 < 1200. Within margin.
      const zoom = createFakeZoomState({
        zoomScale: scaleForWidth(100),
        viewportWidth: 1000,
        viewportHeight: 800,
        focusX: -5,
      });

      const tiers = computer.computeTiers(tree, positions, zoom);

      expect(tiers.get('n1')).not.toBe('culled');
    });

    it('culls a node above the viewport beyond 200px margin', () => {
      const positions = new Map([['n1', { x: 0, y: -50 }]]);
      const tree = createFakeTree('other');
      const zoom = createFakeZoomState({
        zoomScale: scaleForWidth(100),
        viewportWidth: 1000,
        viewportHeight: 800,
      });
      // Screen y = (-50 - 0) * 125 + 400 = -5850.
      // Node half-height = 0.6 * 125 / 2 = 37.5
      // rectBottom = -5850 + 37.5 = -5812.5. < -200. Culled.

      const tiers = computer.computeTiers(tree, positions, zoom);

      expect(tiers.get('n1')).toBe('culled');
    });

    it('on-screen node at viewport center is not culled', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');
      const zoom = createFakeZoomState({ zoomScale: scaleForWidth(100) });

      const tiers = computer.computeTiers(tree, positions, zoom);

      expect(tiers.get('n1')).not.toBe('culled');
    });
  });

  describe('probe observability', () => {
    it('fires tierChanged when a node transitions', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');

      // First frame: culled -> favicon
      computer.computeTiers(
        tree,
        positions,
        createFakeZoomState({ zoomScale: scaleForWidth(50) }),
      );

      expect(probe.calls.length).toBe(1);
      expect(probe.calls[0]).toEqual({
        nodeId: 'n1',
        previousTier: 'culled',
        newTier: 'favicon',
      });
    });

    it('does not fire tierChanged when tier is stable', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');
      const zoom = createFakeZoomState({ zoomScale: scaleForWidth(50) });

      computer.computeTiers(tree, positions, zoom);
      probe.calls.length = 0;

      // Same tier, no probe call
      computer.computeTiers(tree, positions, zoom);

      expect(probe.calls.length).toBe(0);
    });

    it('fires tierChanged on demotion', () => {
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');

      // Ramp up to screenshot-low
      stabilize(computer, tree, positions, createFakeZoomState({ zoomScale: scaleForWidth(80) }));
      probe.calls.length = 0;

      // Demote below exit threshold
      computer.computeTiers(
        tree,
        positions,
        createFakeZoomState({ zoomScale: scaleForWidth(59) }),
      );

      expect(probe.calls.length).toBe(1);
      expect(probe.calls[0]).toEqual({
        nodeId: 'n1',
        previousTier: 'screenshot-low',
        newTier: 'favicon',
      });
    });
  });

  describe('constructor without probe', () => {
    it('works without a probe', () => {
      const noProbComputer = new LODComputer(BASE_NODE_WIDTH, BASE_NODE_HEIGHT);
      const positions = new Map([['n1', { x: 0, y: 0 }]]);
      const tree = createFakeTree('other');
      const zoom = createFakeZoomState({ zoomScale: scaleForWidth(50) });

      const tiers = noProbComputer.computeTiers(tree, positions, zoom);

      expect(tiers.get('n1')).toBe('favicon');
    });
  });
});
