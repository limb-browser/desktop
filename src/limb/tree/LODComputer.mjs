// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * @typedef {'culled' | 'favicon' | 'screenshot-low' | 'screenshot-high' | 'live' | 'focused'} LODTier
 */

/**
 * Ordered list of non-focused visible tiers, lowest to highest.
 * @type {readonly string[]}
 */
const VISIBLE_TIERS = ['favicon', 'screenshot-low', 'screenshot-high', 'live'];

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

  /**
   * @param {number} baseNodeWidth - Logical node width (same unit as layout positions)
   * @param {number} baseNodeHeight - Logical node height
   * @param {{ tierChanged(nodeId: string, previousTier: string, newTier: string): void }} [probe]
   */
  constructor(baseNodeWidth, baseNodeHeight, probe) {
    this.#baseNodeWidth = baseNodeWidth;
    this.#baseNodeHeight = baseNodeHeight;
    this.#probe = probe ?? null;
  }

  /**
   * Compute LOD tiers for all nodes.
   *
   * @param {{ focusedNodeId: string }} tree - Tree with focused node info
   * @param {Map<string, { x: number, y: number }>} layout - Logical node positions
   * @param {{ zoomScale: number, level: number, viewportSize: { width: number, height: number }, logicalToScreen(x: number, y: number): { x: number, y: number } }} zoomState
   * @returns {Map<string, LODTier>}
   */
  computeTiers(tree, layout, zoomState) {
    const result = /** @type {Map<string, string>} */ (new Map());
    const zoomScale = zoomState.zoomScale;
    const zoomLevel = zoomState.level;
    const vpW = zoomState.viewportSize.width;
    const vpH = zoomState.viewportSize.height;
    const nodeScreenWidth = this.#baseNodeWidth * zoomScale;
    const nodeScreenHeight = this.#baseNodeHeight * zoomScale;
    const halfW = nodeScreenWidth / 2;
    const halfH = nodeScreenHeight / 2;

    for (const [nodeId, pos] of layout) {
      // Focused node: always at least Live, exempt from monotonic
      if (nodeId === tree.focusedNodeId) {
        const tier = zoomLevel >= 0.9 ? 'focused' : 'live';
        result.set(nodeId, tier);
        continue;
      }

      // Visibility check with 200px culling margin
      const screen = zoomState.logicalToScreen(pos.x, pos.y);
      const rectLeft = screen.x - halfW;
      const rectTop = screen.y - halfH;
      const rectRight = screen.x + halfW;
      const rectBottom = screen.y + halfH;

      if (
        rectRight < -CULLING_MARGIN ||
        rectLeft > vpW + CULLING_MARGIN ||
        rectBottom < -CULLING_MARGIN ||
        rectTop > vpH + CULLING_MARGIN
      ) {
        result.set(nodeId, 'culled');
        continue;
      }

      // Compute raw tier from standard (enter) thresholds
      const rawTier = rawTierFromWidth(nodeScreenWidth);

      // Apply hysteresis
      const previousTier = this.#previousTiers.get(nodeId) ?? 'culled';
      const hystTier = applyHysteresis(rawTier, previousTier, nodeScreenWidth);

      // Apply monotonic constraint: at most one tier step from previous
      const finalTier = applyMonotonic(hystTier, previousTier);

      result.set(nodeId, finalTier);
    }

    // Fire probe for transitions and update previous tiers
    for (const [nodeId, newTier] of result) {
      const prevTier = this.#previousTiers.get(nodeId) ?? 'culled';
      if (prevTier !== newTier) {
        this.#probe?.tierChanged(nodeId, prevTier, newTier);
      }
    }

    this.#previousTiers = new Map(result);
    return result;
  }
}

/**
 * Determine tier from nodeScreenWidth using standard (enter) thresholds.
 * @param {number} width
 * @returns {string}
 */
function rawTierFromWidth(width) {
  if (width >= 600) return 'live';
  if (width >= 300) return 'screenshot-high';
  if (width >= 80) return 'screenshot-low';
  return 'favicon';
}

/**
 * Apply hysteresis deadband. When demoting, use the exit threshold
 * of the previous tier. If width is in the deadband, stay at previous tier.
 *
 * @param {string} rawTier - Tier from standard thresholds
 * @param {string} previousTier - Previous frame's tier
 * @param {number} nodeScreenWidth
 * @returns {string}
 */
function applyHysteresis(rawTier, previousTier, nodeScreenWidth) {
  const rawOrd = TIER_ORDINAL[rawTier];
  const prevOrd = TIER_ORDINAL[previousTier];

  // Same or promoting: use raw tier (enter thresholds ARE the standard ones)
  if (rawOrd >= prevOrd) {
    return rawTier;
  }

  // Demoting: check exit threshold of the previous tier
  const exitThresh = EXIT_THRESHOLD[previousTier];
  if (exitThresh !== undefined && nodeScreenWidth >= exitThresh) {
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
