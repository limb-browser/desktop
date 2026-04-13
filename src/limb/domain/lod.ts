import type { ZoomState } from './zoom';
import { computeNodeScreenWidth } from './zoom';
import type { LODProbe } from '../ports/lod-probe';

export type { LODTier } from '../ports/lod-probe';

type LODTier = import('../ports/lod-probe').LODTier;

export function naiveTier(screenWidth: number): LODTier {
  if (screenWidth < 80) return 'favicon';
  if (screenWidth < 300) return 'screenshot-low';
  if (screenWidth < 600) return 'screenshot-high';
  return 'live';
}

// Apply hysteresis deadband: only check the adjacent tier boundaries from the
// previous tier so that a node stays in its current tier within the deadband
// and moves at most one tier per cycle (monotonic transitions per §5.2).
function applyHysteresis(screenWidth: number, previousTier: LODTier): LODTier {
  switch (previousTier) {
    case 'favicon':
      if (screenWidth >= 80) return 'screenshot-low';
      return 'favicon';

    case 'screenshot-low':
      if (screenWidth >= 300) return 'screenshot-high';
      if (screenWidth < 60) return 'favicon';
      return 'screenshot-low';

    case 'screenshot-high':
      if (screenWidth >= 600) return 'live';
      if (screenWidth < 250) return 'screenshot-low';
      return 'screenshot-high';

    case 'live':
      if (screenWidth < 450) return 'screenshot-high';
      return 'live';

    case 'culled':
      return naiveTier(screenWidth);

    case 'focused':
      // Previously focused node lost focus; treat as coming from live
      if (screenWidth < 450) return 'screenshot-high';
      return 'live';
  }
}

// Consolidated tier assignment for a single node. Handles the focused/live/culled
// cascade and applies hysteresis when a previousTier is available.
export function computeNodeTier(
  isFocused: boolean,
  isVisible: boolean,
  zoomLevel: number,
  nodeScreenWidth: number,
  previousTier: LODTier | undefined
): LODTier {
  if (isFocused && zoomLevel >= 0.9) return 'focused';
  if (isFocused) return 'live';
  if (!isVisible) return 'culled';
  if (previousTier === undefined) return naiveTier(nodeScreenWidth);
  return applyHysteresis(nodeScreenWidth, previousTier);
}

export function assignTiers(
  tree: { focusedNodeId: string },
  layout: Map<string, { x: number; y: number }>,
  zoomState: ZoomState,
  visibility: Map<string, boolean>,
  probe: LODProbe
): Map<string, LODTier> {
  const result = new Map<string, LODTier>();

  // Reuse the canonical formula from zoom.ts. The _node parameter is unused
  // by computeNodeScreenWidth — all nodes share the same screen width at a
  // given zoom level — so we pass a placeholder.
  const nodeScreenWidth = computeNodeScreenWidth(null as any, zoomState, layout);

  for (const [nodeId, visible] of visibility) {
    const isFocused = nodeId === tree.focusedNodeId;
    const tier = computeNodeTier(isFocused, visible, zoomState.level, nodeScreenWidth, undefined);

    result.set(nodeId, tier);
    probe.tierAssigned(nodeId, tier);
  }

  return result;
}

export function assignTiersWithHysteresis(
  tree: { focusedNodeId: string },
  layout: Map<string, { x: number; y: number }>,
  zoomState: ZoomState,
  visibility: Map<string, boolean>,
  previousTiers: Map<string, LODTier>,
  probe: LODProbe
): Map<string, LODTier> {
  const result = new Map<string, LODTier>();

  const nodeScreenWidth = computeNodeScreenWidth(null as any, zoomState, layout);

  for (const [nodeId, visible] of visibility) {
    const isFocused = nodeId === tree.focusedNodeId;
    const previousTier = previousTiers.get(nodeId);
    const tier = computeNodeTier(isFocused, visible, zoomState.level, nodeScreenWidth, previousTier);

    result.set(nodeId, tier);
    probe.tierAssigned(nodeId, tier);

    if (previousTier !== undefined && tier !== previousTier) {
      probe.tierTransitioned(nodeId, previousTier, tier);
    }
  }

  return result;
}
