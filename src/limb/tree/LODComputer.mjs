// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { SpatialIndex } from './SpatialIndex.mjs';

/**
 * @typedef {'culled' | 'favicon' | 'screenshot-low' | 'screenshot-high' | 'live' | 'focused'} LODTier
 */

/**
 * Ordinal index for monotonic clamping. Culled = 0, favicon = 1, etc.
 * @type {Record<string, number>}
 */
const TIER_ORDINAL = {
  'culled': 0,
  'favicon': 1,
  'screenshot-low': 2,
  'screenshot-high': 3,
  'live': 4,
  'focused': 5,
};

/**
 * Tier names by ordinal (0..4, excluding focused which is special-cased).
 * @type {readonly string[]}
 */
const TIER_BY_ORDINAL = ['culled', 'favicon', 'screenshot-low', 'screenshot-high', 'live'];

/**
 * Exit thresholds per tier. A node at this tier demotes when width falls
 * strictly below the threshold. Favicon has no lower exit.
 * @type {Record<string, number>}
 */
const EXIT_THRESHOLD = {
  'screenshot-low': 60,
  'screenshot-high': 250,
  'live': 450,
};

const CULLING_MARGIN = 200;
const FRAME_BUDGET_MS = 4;

/**
 * Computes LOD tiers for tree nodes based on zoom, visibility, and hysteresis.
 *
 * Tier definitions (zoom-lod.md S2.1):
 * - Culled: off-screen (outside viewport + 200px margin)
 * - Favicon: on-screen, nodeScreenWidth < 80px
 * - Screenshot-Low: 80 <= nodeScreenWidth < 300
 * - Screenshot-High: 300 <= nodeScreenWidth < 600
 * - Live: nodeScreenWidth >= 600
 * - Focused: focusedNodeId AND level >= 0.9
 *
 * Hysteresis (zoom-lod.md S2.3): uses enter/exit deadbands at tier boundaries.
 * Monotonic (zoom-lod.md S5.2): non-focused nodes change at most one tier per cycle.
 *
 * Performance optimizations (performance.md S2.1, S2.3):
 * - Spatial index for fast viewport intersection queries.
 * - Dirty flags: only recompute nodes whose nodeScreenWidth crossed a tier boundary.
 * - Frame budget: defer low-priority nodes when computation exceeds 4ms.
 *
 * Implements the LODProbe port for observability (see ports/LODProbe.ts).
 */
export class LODComputer {
  /** @type {number} */
  #baseNodeWidth;
  /** @type {number} */
  #baseNodeHeight;
  /** @type {Map<string, string>} previous tier per node */
  #previousTiers = new Map();
  /** @type {{ tierChanged(nodeId: string, previousTier: string, newTier: string): void } | null} */
  #probe;
  /** @type {import('../ports/PerformanceProbe').PerformanceProbe | null} */
  #performanceProbe;
  /** @type {() => number} */
  #now;
  /** @type {SpatialIndex} */
  #spatialIndex;
  /** @type {Set<string>} node IDs deferred from the previous frame */
  #deferredNodeIds = new Set();
  /** @type {Map<string, { x: number, y: number }> | null} layout reference for rebuild detection */
  #lastLayout = null;
  /** @type {number} */
  #frameBudgetMs;
  /** @type {number} */
  #thresholdMultiplier = 1.0;

  /**
   * @param {number} baseNodeWidth - Logical node width (same unit as layout positions)
   * @param {number} baseNodeHeight - Logical node height
   * @param {{ tierChanged(nodeId: string, previousTier: string, newTier: string): void }} [probe]
   * @param {{ performanceProbe?: import('../ports/PerformanceProbe').PerformanceProbe, now?: () => number, frameBudgetMs?: number }} [options]
   */
  constructor(baseNodeWidth, baseNodeHeight, probe, options) {
    this.#baseNodeWidth = baseNodeWidth;
    this.#baseNodeHeight = baseNodeHeight;
    this.#probe = probe ?? null;
    this.#performanceProbe = options?.performanceProbe ?? null;
    this.#now = options?.now ?? (() => performance.now());
    this.#spatialIndex = new SpatialIndex();
    this.#frameBudgetMs = options?.frameBudgetMs ?? FRAME_BUDGET_MS;
  }

  /**
   * Set a multiplier for all LOD tier entry thresholds.
   * In degraded mode, set to 1.5 to raise thresholds by 50%.
   * Set back to 1.0 to restore original thresholds.
   *
   * @param {number} multiplier
   */
  setThresholdMultiplier(multiplier) {
    this.#thresholdMultiplier = multiplier;
  }

  /**
   * Compute LOD tiers for all nodes.
   *
   * Uses a spatial index to find potentially-visible nodes, dirty flags to skip
   * unchanged nodes, and a frame budget to defer low-priority nodes when
   * computation exceeds the budget (performance.md S2.1, S2.3).
   *
   * @param {{ focusedNodeId: string, parentMap?: Map<string, string> }} tree - Tree with focused node and optional parent mapping
   * @param {Map<string, { x: number, y: number }>} layout - Logical node positions
   * @param {{ zoomScale: number, level: number, viewportSize: { width: number, height: number }, logicalToScreen(x: number, y: number): { x: number, y: number } }} zoomState
   * @returns {Map<string, LODTier>}
   */
  computeTiers(tree, layout, zoomState) {
    const start = this.#now();
    const result = /** @type {Map<string, string>} */ (new Map());

    // Rebuild spatial index when layout changes
    if (layout !== this.#lastLayout) {
      this.#spatialIndex.rebuild(layout);
      this.#lastLayout = layout;
    }

    const zoomScale = zoomState.zoomScale;
    const zoomLevel = zoomState.level;
    const vpW = zoomState.viewportSize.width;
    const vpH = zoomState.viewportSize.height;
    const nodeScreenWidth = this.#baseNodeWidth * zoomScale;
    const nodeScreenHeight = this.#baseNodeHeight * zoomScale;
    const halfW = nodeScreenWidth / 2;
    const halfH = nodeScreenHeight / 2;

    // Convert viewport+margin to logical coordinates for spatial query.
    // logicalToScreen: screenX = logX * zoomScale + screenOrigin.x
    // so logX = (screenX - screenOrigin.x) / zoomScale
    const screenOrigin = zoomState.logicalToScreen(0, 0);
    const logMinX = (-CULLING_MARGIN - halfW - screenOrigin.x) / zoomScale;
    const logMinY = (-CULLING_MARGIN - halfH - screenOrigin.y) / zoomScale;
    const logMaxX = (vpW + CULLING_MARGIN + halfW - screenOrigin.x) / zoomScale;
    const logMaxY = (vpH + CULLING_MARGIN + halfH - screenOrigin.y) / zoomScale;

    // Query spatial index for potentially-visible nodes
    const visibleNodeIds = new Set(
      this.#spatialIndex.queryRegion(logMinX, logMinY, logMaxX, logMaxY),
    );

    // Collect dirty nodes and assign tiers for clean/culled nodes
    const dirtyNodes = [];

    for (const [nodeId] of layout) {
      // Focused node: always process (exempt from culling and budget)
      if (nodeId === tree.focusedNodeId) {
        dirtyNodes.push(nodeId);
        continue;
      }

      // Not in viewport: culled
      if (!visibleNodeIds.has(nodeId)) {
        result.set(nodeId, 'culled');
        continue;
      }

      const previousTier = this.#previousTiers.get(nodeId) ?? 'culled';

      // Deferred from previous frame: always reprocess
      if (this.#deferredNodeIds.has(nodeId)) {
        dirtyNodes.push(nodeId);
        continue;
      }

      // Was culled, now on-screen: dirty
      if (previousTier === 'culled') {
        dirtyNodes.push(nodeId);
        continue;
      }

      // Check if nodeScreenWidth crossed a tier boundary for this node's current tier
      if (isDirtyNode(previousTier, nodeScreenWidth, this.#thresholdMultiplier)) {
        dirtyNodes.push(nodeId);
        continue;
      }

      // Clean: retain previous tier
      result.set(nodeId, previousTier);
    }

    // Sort dirty nodes by priority: focused > ancestors > siblings > descendants > distant
    const parentMap = tree.parentMap;
    if (parentMap && tree.focusedNodeId) {
      const ancestorSet = computeAncestorSet(tree.focusedNodeId, parentMap);
      const focusedParent = parentMap.get(tree.focusedNodeId);
      dirtyNodes.sort((a, b) => {
        const pa = getNodePriority(a, tree.focusedNodeId, ancestorSet, focusedParent, parentMap);
        const pb = getNodePriority(b, tree.focusedNodeId, ancestorSet, focusedParent, parentMap);
        return pa - pb;
      });
    }

    // Process dirty nodes within frame budget (performance.md S2.3)
    const newDeferred = new Set();
    for (const nodeId of dirtyNodes) {
      const elapsed = this.#now() - start;
      if (elapsed > this.#frameBudgetMs && nodeId !== tree.focusedNodeId) {
        // Budget exceeded: defer this node, retain its previous tier
        newDeferred.add(nodeId);
        result.set(nodeId, this.#previousTiers.get(nodeId) ?? 'culled');
        continue;
      }

      // Focused node: always at least Live, exempt from monotonic
      if (nodeId === tree.focusedNodeId) {
        const tier = zoomLevel >= 0.9 ? 'focused' : 'live';
        result.set(nodeId, tier);
        continue;
      }

      // Compute raw tier from standard (enter) thresholds
      const rawTier = rawTierFromWidth(nodeScreenWidth, this.#thresholdMultiplier);

      // Apply hysteresis
      const previousTier = this.#previousTiers.get(nodeId) ?? 'culled';
      const hystTier = applyHysteresis(rawTier, previousTier, nodeScreenWidth, this.#thresholdMultiplier);

      // Apply monotonic constraint: at most one tier step from previous
      const finalTier = applyMonotonic(hystTier, previousTier);

      result.set(nodeId, finalTier);
    }

    this.#deferredNodeIds = newDeferred;

    // Fire probe for transitions and update previous tiers
    for (const [nodeId, newTier] of result) {
      const prevTier = this.#previousTiers.get(nodeId) ?? 'culled';
      if (prevTier !== newTier) {
        this.#probe?.tierChanged(nodeId, prevTier, newTier);
      }
    }

    this.#previousTiers = new Map(result);
    const elapsed = this.#now() - start;
    this.#performanceProbe?.lodComputationTime(elapsed);
    return result;
  }
}

/**
 * Determine tier from nodeScreenWidth using standard (enter) thresholds,
 * scaled by a multiplier for degraded mode.
 * @param {number} width
 * @param {number} [multiplier]
 * @returns {string}
 */
function rawTierFromWidth(width, multiplier = 1.0) {
  if (width >= 600 * multiplier) return 'live';
  if (width >= 300 * multiplier) return 'screenshot-high';
  if (width >= 80 * multiplier) return 'screenshot-low';
  return 'favicon';
}

/**
 * Check whether a node needs tier recomputation given its current tier
 * and the new nodeScreenWidth.
 *
 * A node is "dirty" (needs recomputation) when the new width falls outside
 * the stable band for its current tier. The stable band accounts for both
 * enter thresholds (promotion) and exit thresholds (hysteresis deadband).
 *
 * @param {string} currentTier - The node's tier from the previous frame
 * @param {number} nodeScreenWidth - The current nodeScreenWidth
 * @param {number} [multiplier]
 * @returns {boolean} true if the node needs recomputation
 */
function isDirtyNode(currentTier, nodeScreenWidth, multiplier = 1.0) {
  const rawTier = rawTierFromWidth(nodeScreenWidth, multiplier);
  const rawOrd = TIER_ORDINAL[rawTier];
  const curOrd = TIER_ORDINAL[currentTier];

  // Same tier: no change possible
  if (rawOrd === curOrd) return false;

  // Promoting: always dirty
  if (rawOrd > curOrd) return true;

  // Demoting: check exit threshold (deadband)
  const exitThresh = EXIT_THRESHOLD[currentTier];
  if (exitThresh !== undefined && nodeScreenWidth >= exitThresh * multiplier) return false;

  return true;
}

/**
 * Apply hysteresis deadband. When demoting, use the exit threshold
 * of the previous tier. If width is in the deadband, stay at previous tier.
 *
 * @param {string} rawTier - Tier from standard thresholds
 * @param {string} previousTier - Previous frame's tier
 * @param {number} nodeScreenWidth
 * @param {number} [multiplier]
 * @returns {string}
 */
function applyHysteresis(rawTier, previousTier, nodeScreenWidth, multiplier = 1.0) {
  const rawOrd = TIER_ORDINAL[rawTier];
  const prevOrd = TIER_ORDINAL[previousTier];

  // Same or promoting: use raw tier (enter thresholds ARE the standard ones)
  if (rawOrd >= prevOrd) {
    return rawTier;
  }

  // Demoting: check exit threshold of the previous tier
  const exitThresh = EXIT_THRESHOLD[previousTier];
  if (exitThresh !== undefined && nodeScreenWidth >= exitThresh * multiplier) {
    // Width is in the deadband — stay at previous tier
    return previousTier;
  }

  // Below exit threshold — drop to raw tier
  return rawTier;
}

/**
 * Apply monotonic constraint: a non-focused node changes at most one tier
 * per computation cycle.
 *
 * @param {string} targetTier - Desired tier after hysteresis
 * @param {string} previousTier - Previous frame's tier
 * @returns {string}
 */
function applyMonotonic(targetTier, previousTier) {
  const targetOrd = TIER_ORDINAL[targetTier];
  const prevOrd = TIER_ORDINAL[previousTier];

  if (targetOrd === prevOrd) return targetTier;

  if (targetOrd > prevOrd) {
    // Promoting: step up by one
    return TIER_BY_ORDINAL[prevOrd + 1];
  }

  // Demoting: step down by one
  return TIER_BY_ORDINAL[prevOrd - 1];
}

/**
 * Compute the set of ancestor node IDs for a given node.
 * @param {string} nodeId
 * @param {Map<string, string>} parentMap - childId to parentId
 * @returns {Set<string>}
 */
function computeAncestorSet(nodeId, parentMap) {
  const ancestors = new Set();
  let current = parentMap.get(nodeId);
  while (current) {
    ancestors.add(current);
    current = parentMap.get(current);
  }
  return ancestors;
}

/**
 * Compute the priority of a node relative to the focused node.
 * 0 = focused, 1 = ancestor, 2 = sibling, 3 = descendant, 4 = distant.
 *
 * @param {string} nodeId
 * @param {string} focusedNodeId
 * @param {Set<string>} ancestorSet - Pre-computed ancestors of focusedNodeId
 * @param {string | undefined} focusedParent - Parent of focusedNodeId
 * @param {Map<string, string>} parentMap
 * @returns {number}
 */
function getNodePriority(nodeId, focusedNodeId, ancestorSet, focusedParent, parentMap) {
  if (nodeId === focusedNodeId) return 0;
  if (ancestorSet.has(nodeId)) return 1;
  if (focusedParent && parentMap.get(nodeId) === focusedParent) return 2;

  // Check if descendant of focused node
  let current = parentMap.get(nodeId);
  while (current) {
    if (current === focusedNodeId) return 3;
    current = parentMap.get(current);
  }

  return 4;
}
