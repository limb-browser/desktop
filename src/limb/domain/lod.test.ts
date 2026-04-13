import { describe, it, expect } from 'vitest';
import { assignTiers, assignTiersWithHysteresis } from './lod';
import type { LODTier } from '../ports/lod-probe';
import type { ZoomState } from './zoom';
import { FakeLODProbe } from './__test-utils__/fake-lod-probe';

// With a single-node layout and level = 1.0, nodeScreenWidth equals
// viewportSize.width (because pow(treeWidth, 1)/treeWidth = 1 regardless of
// EFFECTIVE_MIN_TREE_WIDTH). This lets us control screen width directly.
function singleNodeSetup(opts: {
  viewportWidth: number;
  level?: number;
  focusedNodeId?: string;
  nodeId?: string;
}) {
  const nodeId = opts.nodeId ?? 'n';
  const probe = new FakeLODProbe();
  const layout = new Map([[nodeId, { x: 0, y: 0 }]]);
  const visibility = new Map([[nodeId, true]]);
  const tree = { focusedNodeId: opts.focusedNodeId ?? 'other' };
  const zoomState: ZoomState = {
    level: opts.level ?? 1.0,
    focusPoint: { x: 0, y: 0 },
    viewportSize: { width: opts.viewportWidth, height: 600 },
  };
  return { probe, layout, visibility, tree, zoomState, nodeId };
}

describe('assignTiers', () => {
  it('assigns culled tier to off-screen node', () => {
    const probe = new FakeLODProbe();
    const layout = new Map([
      ['visible', { x: 0, y: 0 }],
      ['offscreen', { x: 1, y: 0 }],
    ]);
    const visibility = new Map([
      ['visible', true],
      ['offscreen', false],
    ]);
    const tree = { focusedNodeId: 'visible' };
    const zoomState: ZoomState = {
      level: 0.5,
      focusPoint: { x: 0, y: 0 },
      viewportSize: { width: 800, height: 600 },
    };

    const tiers = assignTiers(tree, layout, zoomState, visibility, probe);

    expect(tiers.get('offscreen')).toBe('culled');
    expect(probe.assignments).toContainEqual({ nodeId: 'offscreen', tier: 'culled' });
  });

  it('assigns favicon tier when nodeScreenWidth < 80px', () => {
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      singleNodeSetup({ viewportWidth: 50 });

    const tiers = assignTiers(tree, layout, zoomState, visibility, probe);

    expect(tiers.get(nodeId)).toBe('favicon');
    expect(probe.assignments).toContainEqual({ nodeId, tier: 'favicon' });
  });

  it('assigns screenshot-low tier when 80px <= nodeScreenWidth < 300px', () => {
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      singleNodeSetup({ viewportWidth: 150 });

    const tiers = assignTiers(tree, layout, zoomState, visibility, probe);

    expect(tiers.get(nodeId)).toBe('screenshot-low');
    expect(probe.assignments).toContainEqual({ nodeId, tier: 'screenshot-low' });
  });

  it('assigns screenshot-high tier when 300px <= nodeScreenWidth < 600px', () => {
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      singleNodeSetup({ viewportWidth: 400 });

    const tiers = assignTiers(tree, layout, zoomState, visibility, probe);

    expect(tiers.get(nodeId)).toBe('screenshot-high');
    expect(probe.assignments).toContainEqual({ nodeId, tier: 'screenshot-high' });
  });

  it('assigns live tier when nodeScreenWidth >= 600px', () => {
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      singleNodeSetup({ viewportWidth: 800 });

    const tiers = assignTiers(tree, layout, zoomState, visibility, probe);

    expect(tiers.get(nodeId)).toBe('live');
    expect(probe.assignments).toContainEqual({ nodeId, tier: 'live' });
  });

  it('assigns focused tier to focused node when level >= 0.9', () => {
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      singleNodeSetup({ viewportWidth: 800, level: 0.95, focusedNodeId: 'n' });

    const tiers = assignTiers(tree, layout, zoomState, visibility, probe);

    expect(tiers.get(nodeId)).toBe('focused');
    expect(probe.assignments).toContainEqual({ nodeId, tier: 'focused' });
  });

  it('assigns live tier (not focused) to focused node when level < 0.9', () => {
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      singleNodeSetup({ viewportWidth: 800, level: 0.5, focusedNodeId: 'n' });

    const tiers = assignTiers(tree, layout, zoomState, visibility, probe);

    expect(tiers.get(nodeId)).toBe('live');
    expect(probe.assignments).toContainEqual({ nodeId, tier: 'live' });
  });

  it('focused node never drops below live tier even at small screen widths', () => {
    // viewportWidth = 50 → nodeScreenWidth = 50 → normally favicon
    // But node is focused → invariant: always at least live
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      singleNodeSetup({ viewportWidth: 50, level: 0.5, focusedNodeId: 'n' });

    const tiers = assignTiers(tree, layout, zoomState, visibility, probe);

    expect(tiers.get(nodeId)).toBe('live');
    expect(probe.assignments).toContainEqual({ nodeId, tier: 'live' });
  });

  it('focused node never drops below live tier even when off-screen', () => {
    // Node is off-screen (visible=false) → normally culled
    // But node is focused → invariant §5.3: always at least live
    const probe = new FakeLODProbe();
    const layout = new Map([['n', { x: 0, y: 0 }]]);
    const visibility = new Map([['n', false]]);
    const tree = { focusedNodeId: 'n' };
    const zoomState: ZoomState = {
      level: 0.5,
      focusPoint: { x: 0, y: 0 },
      viewportSize: { width: 800, height: 600 },
    };

    const tiers = assignTiers(tree, layout, zoomState, visibility, probe);

    expect(tiers.get('n')).toBe('live');
    expect(probe.assignments).toContainEqual({ nodeId: 'n', tier: 'live' });
  });

  it('emits tierAssigned for every node', () => {
    const probe = new FakeLODProbe();
    const layout = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 1, y: 0 }],
    ]);
    const visibility = new Map([
      ['a', true],
      ['b', false],
    ]);
    const tree = { focusedNodeId: 'a' };
    const zoomState: ZoomState = {
      level: 0.5,
      focusPoint: { x: 0, y: 0 },
      viewportSize: { width: 800, height: 600 },
    };

    assignTiers(tree, layout, zoomState, visibility, probe);

    expect(probe.assignments).toHaveLength(2);
    expect(probe.assignments).toContainEqual({ nodeId: 'b', tier: 'culled' });
    const tierA = probe.assignments.find(a => a.nodeId === 'a');
    expect(tierA).toBeDefined();
    expect(tierA!.tier).not.toBe('culled');
  });

  it('assigns at exact boundary: 80px gets screenshot-low', () => {
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      singleNodeSetup({ viewportWidth: 80 });

    const tiers = assignTiers(tree, layout, zoomState, visibility, probe);

    expect(tiers.get(nodeId)).toBe('screenshot-low');
    expect(probe.assignments).toContainEqual({ nodeId, tier: 'screenshot-low' });
  });

  it('assigns at exact boundary: 300px gets screenshot-high', () => {
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      singleNodeSetup({ viewportWidth: 300 });

    const tiers = assignTiers(tree, layout, zoomState, visibility, probe);

    expect(tiers.get(nodeId)).toBe('screenshot-high');
    expect(probe.assignments).toContainEqual({ nodeId, tier: 'screenshot-high' });
  });

  it('assigns at exact boundary: 600px gets live', () => {
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      singleNodeSetup({ viewportWidth: 600 });

    const tiers = assignTiers(tree, layout, zoomState, visibility, probe);

    expect(tiers.get(nodeId)).toBe('live');
    expect(probe.assignments).toContainEqual({ nodeId, tier: 'live' });
  });

  it('assigns at exact boundary: level 0.9 is focused for focused node', () => {
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      singleNodeSetup({ viewportWidth: 800, level: 0.9, focusedNodeId: 'n' });

    const tiers = assignTiers(tree, layout, zoomState, visibility, probe);

    expect(tiers.get(nodeId)).toBe('focused');
    expect(probe.assignments).toContainEqual({ nodeId, tier: 'focused' });
  });
});

// Helper for hysteresis tests: creates a setup and returns a function to call
// assignTiersWithHysteresis with a given viewport width and previous tiers.
function hysteresisSetup(opts: {
  viewportWidth: number;
  previousTiers: Map<string, LODTier>;
  nodeId?: string;
  focusedNodeId?: string;
  level?: number;
  visible?: boolean;
}) {
  const nodeId = opts.nodeId ?? 'n';
  const probe = new FakeLODProbe();
  const layout = new Map([[nodeId, { x: 0, y: 0 }]]);
  const visibility = new Map([[nodeId, opts.visible ?? true]]);
  const tree = { focusedNodeId: opts.focusedNodeId ?? 'other' };
  const zoomState: ZoomState = {
    level: opts.level ?? 1.0,
    focusPoint: { x: 0, y: 0 },
    viewportSize: { width: opts.viewportWidth, height: 600 },
  };
  return { probe, layout, visibility, tree, zoomState, nodeId, previousTiers: opts.previousTiers };
}

describe('assignTiersWithHysteresis', () => {
  it('assigns naively when no previous tiers exist', () => {
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      hysteresisSetup({ viewportWidth: 150, previousTiers: new Map() });

    const tiers = assignTiersWithHysteresis(tree, layout, zoomState, visibility, new Map(), probe);

    expect(tiers.get(nodeId)).toBe('screenshot-low');
    expect(probe.assignments).toContainEqual({ nodeId, tier: 'screenshot-low' });
  });

  // Hysteresis: screenshot-low stays until < 60px, not < 80px
  it('node promoted to screenshot-low at 80px stays there at 75px (above exit threshold 60px)', () => {
    const previousTiers = new Map([['n', 'screenshot-low' as LODTier]]);
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      hysteresisSetup({ viewportWidth: 75, previousTiers });

    const tiers = assignTiersWithHysteresis(tree, layout, zoomState, visibility, previousTiers, probe);

    expect(tiers.get(nodeId)).toBe('screenshot-low');
    expect(probe.transitions).toHaveLength(0);
  });

  it('node promoted to screenshot-low demotes to favicon when below 60px', () => {
    const previousTiers = new Map([['n', 'screenshot-low' as LODTier]]);
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      hysteresisSetup({ viewportWidth: 59, previousTiers });

    const tiers = assignTiersWithHysteresis(tree, layout, zoomState, visibility, previousTiers, probe);

    expect(tiers.get(nodeId)).toBe('favicon');
    expect(probe.transitions).toContainEqual({ nodeId, fromTier: 'screenshot-low', toTier: 'favicon' });
  });

  // Hysteresis: screenshot-high stays until < 250px, not < 300px
  it('node promoted to screenshot-high at 300px stays there at 260px (above exit threshold 250px)', () => {
    const previousTiers = new Map([['n', 'screenshot-high' as LODTier]]);
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      hysteresisSetup({ viewportWidth: 260, previousTiers });

    const tiers = assignTiersWithHysteresis(tree, layout, zoomState, visibility, previousTiers, probe);

    expect(tiers.get(nodeId)).toBe('screenshot-high');
    expect(probe.transitions).toHaveLength(0);
  });

  it('node promoted to screenshot-high demotes to screenshot-low when below 250px', () => {
    const previousTiers = new Map([['n', 'screenshot-high' as LODTier]]);
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      hysteresisSetup({ viewportWidth: 249, previousTiers });

    const tiers = assignTiersWithHysteresis(tree, layout, zoomState, visibility, previousTiers, probe);

    expect(tiers.get(nodeId)).toBe('screenshot-low');
    expect(probe.transitions).toContainEqual({ nodeId, fromTier: 'screenshot-high', toTier: 'screenshot-low' });
  });

  // Hysteresis: live stays until < 450px, not < 600px
  it('node promoted to live at 600px stays there at 500px (above exit threshold 450px)', () => {
    const previousTiers = new Map([['n', 'live' as LODTier]]);
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      hysteresisSetup({ viewportWidth: 500, previousTiers });

    const tiers = assignTiersWithHysteresis(tree, layout, zoomState, visibility, previousTiers, probe);

    expect(tiers.get(nodeId)).toBe('live');
    expect(probe.transitions).toHaveLength(0);
  });

  it('node promoted to live demotes to screenshot-high when below 450px', () => {
    const previousTiers = new Map([['n', 'live' as LODTier]]);
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      hysteresisSetup({ viewportWidth: 449, previousTiers });

    const tiers = assignTiersWithHysteresis(tree, layout, zoomState, visibility, previousTiers, probe);

    expect(tiers.get(nodeId)).toBe('screenshot-high');
    expect(probe.transitions).toContainEqual({ nodeId, fromTier: 'live', toTier: 'screenshot-high' });
  });

  // Oscillation: node bouncing between 75px and 85px should NOT thrash
  it('node oscillating near favicon/screenshot-low boundary (75-85px) does not thrash', () => {
    // Start at favicon, promote to screenshot-low at 85px
    const probe1 = new FakeLODProbe();
    const layout = new Map([['n', { x: 0, y: 0 }]]);
    const visibility = new Map([['n', true]]);
    const tree = { focusedNodeId: 'other' };

    // Frame 1: at 85px, no previous → screenshot-low
    const zs1: ZoomState = { level: 1.0, focusPoint: { x: 0, y: 0 }, viewportSize: { width: 85, height: 600 } };
    const tiers1 = assignTiersWithHysteresis(tree, layout, zs1, visibility, new Map(), probe1);
    expect(tiers1.get('n')).toBe('screenshot-low');

    // Frame 2: drop to 75px — still above exit threshold 60px → stays screenshot-low
    const probe2 = new FakeLODProbe();
    const zs2: ZoomState = { level: 1.0, focusPoint: { x: 0, y: 0 }, viewportSize: { width: 75, height: 600 } };
    const tiers2 = assignTiersWithHysteresis(tree, layout, zs2, visibility, tiers1, probe2);
    expect(tiers2.get('n')).toBe('screenshot-low');
    expect(probe2.transitions).toHaveLength(0); // No transition — stable

    // Frame 3: back up to 85px → stays screenshot-low (no change)
    const probe3 = new FakeLODProbe();
    const zs3: ZoomState = { level: 1.0, focusPoint: { x: 0, y: 0 }, viewportSize: { width: 85, height: 600 } };
    const tiers3 = assignTiersWithHysteresis(tree, layout, zs3, visibility, tiers2, probe3);
    expect(tiers3.get('n')).toBe('screenshot-low');
    expect(probe3.transitions).toHaveLength(0); // Still no transition

    // Frame 4: drop to 75px again → stays screenshot-low
    const probe4 = new FakeLODProbe();
    const zs4: ZoomState = { level: 1.0, focusPoint: { x: 0, y: 0 }, viewportSize: { width: 75, height: 600 } };
    const tiers4 = assignTiersWithHysteresis(tree, layout, zs4, visibility, tiers3, probe4);
    expect(tiers4.get('n')).toBe('screenshot-low');
    expect(probe4.transitions).toHaveLength(0); // No thrashing
  });

  // Monotonic: at most one tier change per computation cycle
  it('limits promotion to one tier per cycle (favicon to live takes multiple cycles)', () => {
    const layout = new Map([['n', { x: 0, y: 0 }]]);
    const visibility = new Map([['n', true]]);
    const tree = { focusedNodeId: 'other' };
    // Screen width 700px would naively be "live", but starting from favicon
    // should step through one tier at a time
    const zs: ZoomState = { level: 1.0, focusPoint: { x: 0, y: 0 }, viewportSize: { width: 700, height: 600 } };

    // Cycle 1: favicon → screenshot-low (one step)
    const probe1 = new FakeLODProbe();
    const prev1 = new Map<string, LODTier>([['n', 'favicon']]);
    const tiers1 = assignTiersWithHysteresis(tree, layout, zs, visibility, prev1, probe1);
    expect(tiers1.get('n')).toBe('screenshot-low');
    expect(probe1.transitions).toContainEqual({ nodeId: 'n', fromTier: 'favicon', toTier: 'screenshot-low' });

    // Cycle 2: screenshot-low → screenshot-high (one step)
    const probe2 = new FakeLODProbe();
    const tiers2 = assignTiersWithHysteresis(tree, layout, zs, visibility, tiers1, probe2);
    expect(tiers2.get('n')).toBe('screenshot-high');
    expect(probe2.transitions).toContainEqual({ nodeId: 'n', fromTier: 'screenshot-low', toTier: 'screenshot-high' });

    // Cycle 3: screenshot-high → live (one step)
    const probe3 = new FakeLODProbe();
    const tiers3 = assignTiersWithHysteresis(tree, layout, zs, visibility, tiers2, probe3);
    expect(tiers3.get('n')).toBe('live');
    expect(probe3.transitions).toContainEqual({ nodeId: 'n', fromTier: 'screenshot-high', toTier: 'live' });
  });

  it('limits demotion to one tier per cycle (live to favicon takes multiple cycles)', () => {
    const layout = new Map([['n', { x: 0, y: 0 }]]);
    const visibility = new Map([['n', true]]);
    const tree = { focusedNodeId: 'other' };
    // Screen width 30px would naively be "favicon", but starting from live
    // should step through one tier at a time
    const zs: ZoomState = { level: 1.0, focusPoint: { x: 0, y: 0 }, viewportSize: { width: 30, height: 600 } };

    // Cycle 1: live → screenshot-high (one step)
    const probe1 = new FakeLODProbe();
    const prev1 = new Map<string, LODTier>([['n', 'live']]);
    const tiers1 = assignTiersWithHysteresis(tree, layout, zs, visibility, prev1, probe1);
    expect(tiers1.get('n')).toBe('screenshot-high');

    // Cycle 2: screenshot-high → screenshot-low (one step)
    const probe2 = new FakeLODProbe();
    const tiers2 = assignTiersWithHysteresis(tree, layout, zs, visibility, tiers1, probe2);
    expect(tiers2.get('n')).toBe('screenshot-low');

    // Cycle 3: screenshot-low → favicon (one step)
    const probe3 = new FakeLODProbe();
    const tiers3 = assignTiersWithHysteresis(tree, layout, zs, visibility, tiers2, probe3);
    expect(tiers3.get('n')).toBe('favicon');
  });

  // Probe: tierTransitioned emitted only on actual changes, not stable frames
  it('emits tierTransitioned only when tier actually changes', () => {
    const previousTiers = new Map([['n', 'screenshot-low' as LODTier]]);
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      hysteresisSetup({ viewportWidth: 150, previousTiers });

    assignTiersWithHysteresis(tree, layout, zoomState, visibility, previousTiers, probe);

    // Tier stays screenshot-low → no transition emitted
    expect(probe.transitions).toHaveLength(0);
    // But tierAssigned is still emitted
    expect(probe.assignments).toContainEqual({ nodeId, tier: 'screenshot-low' });
  });

  it('emits tierTransitioned when tier actually changes', () => {
    const previousTiers = new Map([['n', 'favicon' as LODTier]]);
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      hysteresisSetup({ viewportWidth: 150, previousTiers });

    assignTiersWithHysteresis(tree, layout, zoomState, visibility, previousTiers, probe);

    expect(probe.transitions).toContainEqual({ nodeId, fromTier: 'favicon', toTier: 'screenshot-low' });
  });

  // Focused node invariant still holds with hysteresis
  it('focused node is always at least live regardless of hysteresis', () => {
    const previousTiers = new Map([['n', 'favicon' as LODTier]]);
    // Use level < 0.9 so focused node gets 'live' (not 'focused')
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      hysteresisSetup({ viewportWidth: 50, previousTiers, focusedNodeId: 'n', level: 0.5 });

    const tiers = assignTiersWithHysteresis(tree, layout, zoomState, visibility, previousTiers, probe);

    expect(tiers.get(nodeId)).toBe('live');
    expect(probe.transitions).toContainEqual({ nodeId, fromTier: 'favicon', toTier: 'live' });
  });

  // Culled node gets naive assignment
  it('previously culled node that becomes visible gets naive tier', () => {
    const previousTiers = new Map([['n', 'culled' as LODTier]]);
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      hysteresisSetup({ viewportWidth: 150, previousTiers });

    const tiers = assignTiersWithHysteresis(tree, layout, zoomState, visibility, previousTiers, probe);

    expect(tiers.get(nodeId)).toBe('screenshot-low');
    expect(probe.transitions).toContainEqual({ nodeId, fromTier: 'culled', toTier: 'screenshot-low' });
  });

  // Node at exact exit boundary
  it('node at exactly 60px (exit threshold) stays at screenshot-low', () => {
    const previousTiers = new Map([['n', 'screenshot-low' as LODTier]]);
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      hysteresisSetup({ viewportWidth: 60, previousTiers });

    const tiers = assignTiersWithHysteresis(tree, layout, zoomState, visibility, previousTiers, probe);

    // Exit is "< 60px", so at exactly 60px we stay
    expect(tiers.get(nodeId)).toBe('screenshot-low');
    expect(probe.transitions).toHaveLength(0);
  });

  it('node at exactly 250px (exit threshold) stays at screenshot-high', () => {
    const previousTiers = new Map([['n', 'screenshot-high' as LODTier]]);
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      hysteresisSetup({ viewportWidth: 250, previousTiers });

    const tiers = assignTiersWithHysteresis(tree, layout, zoomState, visibility, previousTiers, probe);

    expect(tiers.get(nodeId)).toBe('screenshot-high');
    expect(probe.transitions).toHaveLength(0);
  });

  it('node at exactly 450px (exit threshold) stays at live', () => {
    const previousTiers = new Map([['n', 'live' as LODTier]]);
    const { probe, layout, visibility, tree, zoomState, nodeId } =
      hysteresisSetup({ viewportWidth: 450, previousTiers });

    const tiers = assignTiersWithHysteresis(tree, layout, zoomState, visibility, previousTiers, probe);

    expect(tiers.get(nodeId)).toBe('live');
    expect(probe.transitions).toHaveLength(0);
  });
});
