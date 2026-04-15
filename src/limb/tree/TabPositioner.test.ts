// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { TabPositioner } from './TabPositioner.mjs';
import type { TabPositionerProbe } from '../ports/TabPositionerProbe';

const BASE_NODE_WIDTH = 0.8;
const BASE_NODE_HEIGHT = 0.6;

function createFakeProbe(): TabPositionerProbe & {
  inputModeChanges: Array<'canvas' | 'tab'>;
  crossFadeStarts: Array<{ nodeId: string; direction: 'to-live' | 'to-screenshot' }>;
  crossFadeCompletions: string[];
} {
  const inputModeChanges: Array<'canvas' | 'tab'> = [];
  const crossFadeStarts: Array<{ nodeId: string; direction: 'to-live' | 'to-screenshot' }> = [];
  const crossFadeCompletions: string[] = [];
  return {
    inputModeChanges,
    crossFadeStarts,
    crossFadeCompletions,
    inputModeChanged(mode) {
      inputModeChanges.push(mode);
    },
    crossFadeStarted(nodeId, direction) {
      crossFadeStarts.push({ nodeId, direction });
    },
    crossFadeCompleted(nodeId) {
      crossFadeCompletions.push(nodeId);
    },
  };
}

function createFakeLogicalToScreen(
  zoomScale: number,
  focusX = 0,
  focusY = 0,
  vpW = 1920,
  vpH = 1080,
) {
  return (x: number, y: number) => ({
    x: (x - focusX) * zoomScale + vpW / 2,
    y: (y - focusY) * zoomScale + vpH / 2,
  });
}

interface FrameState {
  zoomLevel: number;
  viewportSize: { width: number; height: number };
  focusedNodeId: string | null;
  tiers: Map<string, string>;
  nodePositions: Map<string, { x: number; y: number }>;
  logicalToScreen: (x: number, y: number) => { x: number; y: number };
  baseNodeWidth: number;
  baseNodeHeight: number;
  zoomScale: number;
  maxLiveTabs: number;
}

function createFrameState(overrides: Partial<FrameState> = {}): FrameState {
  const zoomScale = overrides.zoomScale ?? 750;
  const vpW = overrides.viewportSize?.width ?? 1920;
  const vpH = overrides.viewportSize?.height ?? 1080;
  return {
    zoomLevel: 0.5,
    viewportSize: { width: vpW, height: vpH },
    focusedNodeId: null,
    tiers: new Map(),
    nodePositions: new Map(),
    logicalToScreen: overrides.logicalToScreen ?? createFakeLogicalToScreen(zoomScale, 0, 0, vpW, vpH),
    baseNodeWidth: BASE_NODE_WIDTH,
    baseNodeHeight: BASE_NODE_HEIGHT,
    zoomScale,
    maxLiveTabs: 8,
    ...overrides,
  };
}

describe('TabPositioner', () => {
  let positioner: InstanceType<typeof TabPositioner>;
  let probe: ReturnType<typeof createFakeProbe>;
  let clock: number;

  beforeEach(() => {
    clock = 0;
    probe = createFakeProbe();
    positioner = new TabPositioner(probe, { now: () => clock });
  });

  describe('focused tab fills viewport at zoom >= 0.9', () => {
    it('fills viewport when tier is focused at level 0.95', () => {
      const state = createFrameState({
        zoomLevel: 0.95,
        focusedNodeId: 'n1',
        tiers: new Map([['n1', 'focused']]),
        nodePositions: new Map([['n1', { x: 0.5, y: 0.5 }]]),
      });

      const frame = positioner.computeFrame(state);

      expect(frame.focusedTab).toEqual({
        nodeId: 'n1',
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      });
    });

    it('fills viewport at exactly level 0.9', () => {
      const state = createFrameState({
        zoomLevel: 0.9,
        focusedNodeId: 'n1',
        tiers: new Map([['n1', 'focused']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      });

      const frame = positioner.computeFrame(state);

      expect(frame.focusedTab).toEqual({
        nodeId: 'n1',
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      });
    });

    it('fills viewport at level 1.0', () => {
      const state = createFrameState({
        zoomLevel: 1.0,
        focusedNodeId: 'n1',
        tiers: new Map([['n1', 'focused']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      });

      const frame = positioner.computeFrame(state);

      expect(frame.focusedTab).not.toBeNull();
      expect(frame.focusedTab!.width).toBe(1920);
      expect(frame.focusedTab!.height).toBe(1080);
    });
  });

  describe('focused tab scales down at intermediate zoom', () => {
    it('positions focused tab at tree coordinates when tier is live', () => {
      const zoomScale = 750; // nodeScreenWidth = 0.8 * 750 = 600
      const logicalToScreen = createFakeLogicalToScreen(zoomScale);
      const state = createFrameState({
        zoomLevel: 0.7,
        zoomScale,
        focusedNodeId: 'n1',
        tiers: new Map([['n1', 'live']]),
        nodePositions: new Map([['n1', { x: 0.5, y: 0.5 }]]),
        logicalToScreen,
      });

      const frame = positioner.computeFrame(state);

      expect(frame.focusedTab).toBeNull();
      const liveN1 = frame.liveTabs.find((t: any) => t.nodeId === 'n1');
      expect(liveN1).toBeDefined();

      const expectedScreen = logicalToScreen(0.5, 0.5);
      const nodeW = BASE_NODE_WIDTH * zoomScale;
      const nodeH = BASE_NODE_HEIGHT * zoomScale;
      expect(liveN1!.x).toBe(expectedScreen.x - nodeW / 2);
      expect(liveN1!.y).toBe(expectedScreen.y - nodeH / 2);
      expect(liveN1!.width).toBe(nodeW);
      expect(liveN1!.height).toBe(nodeH);
    });

    it('does not show focusedTab when tier is live', () => {
      const state = createFrameState({
        zoomLevel: 0.7,
        focusedNodeId: 'n1',
        tiers: new Map([['n1', 'live']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      });

      const frame = positioner.computeFrame(state);

      expect(frame.focusedTab).toBeNull();
    });
  });

  describe('input mode switching', () => {
    it('returns tab input mode at zoom >= 0.9', () => {
      const state = createFrameState({
        zoomLevel: 0.95,
        focusedNodeId: 'n1',
        tiers: new Map([['n1', 'focused']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      });

      const frame = positioner.computeFrame(state);

      expect(frame.inputMode).toBe('tab');
    });

    it('returns tab input mode at exactly 0.9', () => {
      const state = createFrameState({
        zoomLevel: 0.9,
        focusedNodeId: 'n1',
        tiers: new Map([['n1', 'focused']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      });

      const frame = positioner.computeFrame(state);

      expect(frame.inputMode).toBe('tab');
    });

    it('returns canvas input mode below 0.9', () => {
      const state = createFrameState({
        zoomLevel: 0.89,
        focusedNodeId: 'n1',
        tiers: new Map([['n1', 'live']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      });

      const frame = positioner.computeFrame(state);

      expect(frame.inputMode).toBe('canvas');
    });

    it('fires inputModeChanged probe when mode switches', () => {
      // First frame at tab mode
      positioner.computeFrame(createFrameState({
        zoomLevel: 0.95,
        focusedNodeId: 'n1',
        tiers: new Map([['n1', 'focused']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      // Switch to canvas mode
      positioner.computeFrame(createFrameState({
        zoomLevel: 0.5,
        focusedNodeId: 'n1',
        tiers: new Map([['n1', 'live']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      expect(probe.inputModeChanges).toEqual(['canvas']);
    });

    it('does not fire inputModeChanged when mode stays the same', () => {
      positioner.computeFrame(createFrameState({
        zoomLevel: 0.95,
        focusedNodeId: 'n1',
        tiers: new Map([['n1', 'focused']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      positioner.computeFrame(createFrameState({
        zoomLevel: 0.92,
        focusedNodeId: 'n1',
        tiers: new Map([['n1', 'focused']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      expect(probe.inputModeChanges).toHaveLength(0);
    });

    it('no frame where both canvas and tab accept input', () => {
      // Verify inputMode is always exactly one value
      const states = [0.5, 0.8, 0.89, 0.9, 0.95, 1.0];
      for (const level of states) {
        const frame = positioner.computeFrame(createFrameState({
          zoomLevel: level,
          focusedNodeId: 'n1',
          tiers: new Map([['n1', level >= 0.9 ? 'focused' : 'live']]),
          nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
        }));
        expect(['canvas', 'tab']).toContain(frame.inputMode);
      }
    });
  });

  describe('live non-focused tabs positioned at tree coordinates', () => {
    it('positions live tabs at their screen coordinates', () => {
      const zoomScale = 750;
      const logicalToScreen = createFakeLogicalToScreen(zoomScale);
      const state = createFrameState({
        zoomLevel: 0.7,
        zoomScale,
        focusedNodeId: 'focus',
        tiers: new Map([
          ['focus', 'live'],
          ['n1', 'live'],
          ['n2', 'live'],
        ]),
        nodePositions: new Map([
          ['focus', { x: 0, y: 0 }],
          ['n1', { x: 1, y: 0 }],
          ['n2', { x: 2, y: 0 }],
        ]),
        logicalToScreen,
      });

      const frame = positioner.computeFrame(state);

      const n1Tab = frame.liveTabs.find((t: any) => t.nodeId === 'n1');
      const n2Tab = frame.liveTabs.find((t: any) => t.nodeId === 'n2');
      expect(n1Tab).toBeDefined();
      expect(n2Tab).toBeDefined();

      const nodeW = BASE_NODE_WIDTH * zoomScale;
      const nodeH = BASE_NODE_HEIGHT * zoomScale;
      const screen1 = logicalToScreen(1, 0);
      expect(n1Tab!.x).toBe(screen1.x - nodeW / 2);
      expect(n1Tab!.y).toBe(screen1.y - nodeH / 2);
      expect(n1Tab!.width).toBe(nodeW);
      expect(n1Tab!.height).toBe(nodeH);
    });

    it('does not include non-live tabs in liveTabs', () => {
      const state = createFrameState({
        zoomLevel: 0.7,
        focusedNodeId: 'focus',
        tiers: new Map([
          ['focus', 'live'],
          ['n1', 'screenshot-high'],
          ['n2', 'favicon'],
          ['n3', 'culled'],
        ]),
        nodePositions: new Map([
          ['focus', { x: 0, y: 0 }],
          ['n1', { x: 1, y: 0 }],
          ['n2', { x: 2, y: 0 }],
          ['n3', { x: 3, y: 0 }],
        ]),
      });

      const frame = positioner.computeFrame(state);

      const nonFocusLive = frame.liveTabs.filter((t: any) => t.nodeId !== 'focus');
      expect(nonFocusLive).toHaveLength(0);
    });
  });

  describe('max live tabs limit', () => {
    it('limits non-focused live tabs to maxLiveTabs minus focused slot', () => {
      const state = createFrameState({
        zoomLevel: 0.7,
        focusedNodeId: 'focus',
        maxLiveTabs: 3,
        tiers: new Map([
          ['focus', 'live'],
          ['n1', 'live'],
          ['n2', 'live'],
          ['n3', 'live'],
          ['n4', 'live'],
        ]),
        nodePositions: new Map([
          ['focus', { x: 0, y: 0 }],
          ['n1', { x: 1, y: 0 }],
          ['n2', { x: 2, y: 0 }],
          ['n3', { x: 3, y: 0 }],
          ['n4', { x: 4, y: 0 }],
        ]),
      });

      const frame = positioner.computeFrame(state);

      // 1 slot for focused + 2 for non-focused = 3 total
      const nonFocused = frame.liveTabs.filter((t: any) => t.nodeId !== 'focus');
      expect(nonFocused.length).toBeLessThanOrEqual(2);
      // Total live tabs (focused in liveTabs + non-focused)
      expect(frame.liveTabs.length).toBeLessThanOrEqual(3);
    });

    it('allows all slots for non-focused when no focused node', () => {
      const state = createFrameState({
        zoomLevel: 0.7,
        focusedNodeId: null,
        maxLiveTabs: 2,
        tiers: new Map([
          ['n1', 'live'],
          ['n2', 'live'],
          ['n3', 'live'],
        ]),
        nodePositions: new Map([
          ['n1', { x: 1, y: 0 }],
          ['n2', { x: 2, y: 0 }],
          ['n3', { x: 3, y: 0 }],
        ]),
      });

      const frame = positioner.computeFrame(state);

      expect(frame.liveTabs.length).toBeLessThanOrEqual(2);
    });

    it('focused tab filling viewport still uses a slot', () => {
      const state = createFrameState({
        zoomLevel: 0.95,
        focusedNodeId: 'focus',
        maxLiveTabs: 3,
        tiers: new Map([
          ['focus', 'focused'],
          ['n1', 'live'],
          ['n2', 'live'],
          ['n3', 'live'],
        ]),
        nodePositions: new Map([
          ['focus', { x: 0, y: 0 }],
          ['n1', { x: 1, y: 0 }],
          ['n2', { x: 2, y: 0 }],
          ['n3', { x: 3, y: 0 }],
        ]),
      });

      const frame = positioner.computeFrame(state);

      // focused uses 1 slot, 2 remain for non-focused
      expect(frame.liveTabs.length).toBeLessThanOrEqual(2);
    });
  });

  describe('hide/show based on LOD tier', () => {
    it('culled tier nodes not included in liveTabs or focusedTab', () => {
      const state = createFrameState({
        zoomLevel: 0.5,
        focusedNodeId: 'focus',
        tiers: new Map([
          ['focus', 'live'],
          ['n1', 'culled'],
        ]),
        nodePositions: new Map([
          ['focus', { x: 0, y: 0 }],
          ['n1', { x: 5, y: 5 }],
        ]),
      });

      const frame = positioner.computeFrame(state);

      expect(frame.liveTabs.find((t: any) => t.nodeId === 'n1')).toBeUndefined();
      expect(frame.focusedTab?.nodeId).not.toBe('n1');
    });

    it('favicon tier nodes not included in liveTabs', () => {
      const state = createFrameState({
        tiers: new Map([['n1', 'favicon']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      });

      const frame = positioner.computeFrame(state);

      expect(frame.liveTabs.find((t: any) => t.nodeId === 'n1')).toBeUndefined();
    });

    it('screenshot-low tier nodes not included in liveTabs', () => {
      const state = createFrameState({
        tiers: new Map([['n1', 'screenshot-low']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      });

      const frame = positioner.computeFrame(state);

      expect(frame.liveTabs.find((t: any) => t.nodeId === 'n1')).toBeUndefined();
    });

    it('screenshot-high tier nodes not included in liveTabs', () => {
      const state = createFrameState({
        tiers: new Map([['n1', 'screenshot-high']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      });

      const frame = positioner.computeFrame(state);

      expect(frame.liveTabs.find((t: any) => t.nodeId === 'n1')).toBeUndefined();
    });

    it('live tier nodes are included in liveTabs', () => {
      const state = createFrameState({
        zoomLevel: 0.7,
        tiers: new Map([['n1', 'live']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      });

      const frame = positioner.computeFrame(state);

      expect(frame.liveTabs.find((t: any) => t.nodeId === 'n1')).toBeDefined();
    });
  });

  describe('cross-fade on tier transitions', () => {
    it('cross-fade from screenshot to live starts at opacity 0', () => {
      positioner.onTierChanged('n1', 'screenshot-high', 'live');

      const frame = positioner.computeFrame(createFrameState({
        zoomLevel: 0.7,
        tiers: new Map([['n1', 'live']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      expect(frame.crossFades.get('n1')).toBe(0);
    });

    it('cross-fade from screenshot to live reaches 0.5 at 75ms', () => {
      positioner.onTierChanged('n1', 'screenshot-high', 'live');

      clock = 75;
      const frame = positioner.computeFrame(createFrameState({
        zoomLevel: 0.7,
        tiers: new Map([['n1', 'live']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      expect(frame.crossFades.get('n1')).toBe(0.5);
    });

    it('cross-fade from screenshot to live reaches 1.0 at 150ms', () => {
      positioner.onTierChanged('n1', 'screenshot-high', 'live');

      clock = 150;
      const frame = positioner.computeFrame(createFrameState({
        zoomLevel: 0.7,
        tiers: new Map([['n1', 'live']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      expect(frame.crossFades.get('n1')).toBe(1);
    });

    it('cross-fade from live to screenshot starts at opacity 1', () => {
      positioner.onTierChanged('n1', 'live', 'screenshot-high');

      const frame = positioner.computeFrame(createFrameState({
        tiers: new Map([['n1', 'screenshot-high']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      expect(frame.crossFades.get('n1')).toBe(1);
    });

    it('cross-fade from live to screenshot reaches 0 at 150ms', () => {
      positioner.onTierChanged('n1', 'live', 'screenshot-high');

      clock = 150;
      const frame = positioner.computeFrame(createFrameState({
        tiers: new Map([['n1', 'screenshot-high']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      expect(frame.crossFades.get('n1')).toBe(0);
    });

    it('cross-fade is removed from output after completion frame', () => {
      positioner.onTierChanged('n1', 'screenshot-low', 'live');

      // Completion frame at 150ms (final value still in output)
      clock = 150;
      positioner.computeFrame(createFrameState({
        zoomLevel: 0.7,
        tiers: new Map([['n1', 'live']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      // Next frame after completion: no entry
      clock = 200;
      const frame = positioner.computeFrame(createFrameState({
        zoomLevel: 0.7,
        tiers: new Map([['n1', 'live']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      expect(frame.crossFades.has('n1')).toBe(false);
    });

    it('no cross-fade entry for nodes without active transition', () => {
      const frame = positioner.computeFrame(createFrameState({
        zoomLevel: 0.7,
        tiers: new Map([['n1', 'live']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      expect(frame.crossFades.has('n1')).toBe(false);
    });

    it('fires crossFadeStarted probe on screenshot to live', () => {
      positioner.onTierChanged('n1', 'screenshot-high', 'live');

      expect(probe.crossFadeStarts).toEqual([
        { nodeId: 'n1', direction: 'to-live' },
      ]);
    });

    it('fires crossFadeStarted probe on live to screenshot', () => {
      positioner.onTierChanged('n1', 'live', 'screenshot-low');

      expect(probe.crossFadeStarts).toEqual([
        { nodeId: 'n1', direction: 'to-screenshot' },
      ]);
    });

    it('fires crossFadeCompleted probe when animation finishes', () => {
      positioner.onTierChanged('n1', 'screenshot-high', 'live');

      clock = 150;
      positioner.computeFrame(createFrameState({
        zoomLevel: 0.7,
        tiers: new Map([['n1', 'live']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      expect(probe.crossFadeCompletions).toEqual(['n1']);
    });

    it('does not start cross-fade for non-live/screenshot transitions', () => {
      positioner.onTierChanged('n1', 'culled', 'favicon');

      expect(probe.crossFadeStarts).toHaveLength(0);
    });

    it('handles focused to screenshot transition', () => {
      positioner.onTierChanged('n1', 'focused', 'screenshot-high');

      expect(probe.crossFadeStarts).toEqual([
        { nodeId: 'n1', direction: 'to-screenshot' },
      ]);
    });

    it('handles screenshot to focused transition', () => {
      positioner.onTierChanged('n1', 'screenshot-low', 'focused');

      expect(probe.crossFadeStarts).toEqual([
        { nodeId: 'n1', direction: 'to-live' },
      ]);
    });
  });

  describe('constructor without probe', () => {
    it('works without a probe', () => {
      const noProbPositioner = new TabPositioner();
      const frame = noProbPositioner.computeFrame(createFrameState({
        zoomLevel: 0.95,
        focusedNodeId: 'n1',
        tiers: new Map([['n1', 'focused']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      expect(frame.inputMode).toBe('tab');
      expect(frame.focusedTab).not.toBeNull();
    });

    it('tier changes without probe do not throw', () => {
      const noProbPositioner = new TabPositioner();
      expect(() => {
        noProbPositioner.onTierChanged('n1', 'screenshot-high', 'live');
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('returns null focusedTab when no focused node', () => {
      const frame = positioner.computeFrame(createFrameState({
        focusedNodeId: null,
        tiers: new Map([['n1', 'live']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      expect(frame.focusedTab).toBeNull();
    });

    it('returns empty liveTabs when no live nodes', () => {
      const frame = positioner.computeFrame(createFrameState({
        tiers: new Map([['n1', 'favicon']]),
        nodePositions: new Map([['n1', { x: 0, y: 0 }]]),
      }));

      expect(frame.liveTabs).toHaveLength(0);
    });

    it('handles empty tiers map', () => {
      const frame = positioner.computeFrame(createFrameState());

      expect(frame.focusedTab).toBeNull();
      expect(frame.liveTabs).toHaveLength(0);
    });

    it('skips node without position in nodePositions', () => {
      const state = createFrameState({
        zoomLevel: 0.7,
        tiers: new Map([['n1', 'live']]),
        nodePositions: new Map(), // no position for n1
      });

      const frame = positioner.computeFrame(state);

      expect(frame.liveTabs).toHaveLength(0);
    });
  });
});
