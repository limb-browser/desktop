// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Zoom-out reveal animation (interaction-feel.md S5.2).
 *
 * When zooming out, nodes that enter the viewport animate from 90% to 100%
 * scale over 150ms with ease-out timing. Reveal order follows tree proximity
 * to the focused node: siblings first, then parent, then more distant
 * relatives, staggered by ~30ms per relationship distance.
 */

const REVEAL_DURATION_MS = 150;
const REVEAL_START_SCALE = 0.9;
const REVEAL_STAGGER_MS = 30;

/**
 * Ease-out: t => 1 - (1 - t)^2
 * @param {number} t - Progress fraction 0..1
 * @returns {number}
 */
function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

/**
 * Compute the reveal distance from a node to the focused node.
 *
 * Distance ordering ensures siblings reveal before the parent,
 * and closer relatives reveal before distant ones:
 * - Focused node itself: 0
 * - Siblings of focused: 1
 * - Parent of focused: 2
 * - Siblings of parent (uncles): 3
 * - Grandparent: 4
 * - etc.
 *
 * For ancestors at chain index k (1-indexed from focused):
 *   ancestor itself = 2k
 *   children of ancestor (not on focused path) = 2k - 1
 * Descendants of those children add +1 per extra hop down.
 *
 * @param {string} nodeId
 * @param {string | null} focusedNodeId
 * @param {Map<string, string>} parentMap - childId -> parentId
 * @returns {number}
 */
function computeRevealDistance(nodeId, focusedNodeId, parentMap) {
  if (!focusedNodeId || nodeId === focusedNodeId) return 0;

  // Build ancestor chain of focused node: nodeId -> steps from focused
  const focusedAncestorDepths = new Map();
  let current = focusedNodeId;
  let steps = 0;
  while (current != null) {
    focusedAncestorDepths.set(current, steps);
    current = parentMap.get(current) ?? null;
    steps++;
  }

  // Walk up from nodeId to find the LCA
  let node = nodeId;
  let nodeUp = 0;
  while (node != null && !focusedAncestorDepths.has(node)) {
    node = parentMap.get(node) ?? null;
    nodeUp++;
  }

  if (node == null) return Infinity;

  const focusedUp = focusedAncestorDepths.get(node);

  if (nodeUp === 0) {
    // nodeId is an ancestor of focused
    return focusedUp * 2;
  }
  // Non-ancestor relative: siblings at 2k-1, each hop down adds 1
  return focusedUp * 2 - 1 + (nodeUp - 1);
}

export class RevealAnimator {
  /** @type {Set<string>} */
  #previousVisibleNodeIds = new Set();
  /** @type {Map<string, { elapsed: number, delay: number, distance: number }>} */
  #animations = new Map();
  /** @type {number | null} */
  #previousZoomLevel = null;
  /** @type {import('../ports/RevealAnimationProbe').RevealAnimationProbe | null} */
  #probe;

  /**
   * @param {import('../ports/RevealAnimationProbe').RevealAnimationProbe} [probe]
   */
  constructor(probe) {
    this.#probe = probe ?? null;
  }

  /** @returns {boolean} */
  get isAnimating() {
    return this.#animations.size > 0;
  }

  /**
   * Update reveal animations for the current frame.
   *
   * @param {Set<string>} visibleNodeIds - Node IDs visible in this frame
   * @param {number} currentZoomLevel - Current zoom level (0.0 to 1.0)
   * @param {string | null} focusedNodeId - Currently focused node
   * @param {Map<string, string>} parentMap - childId -> parentId
   * @param {number} deltaMs - Time elapsed since last update
   * @returns {Map<string, number>} nodeId -> reveal scale (0.9 to 1.0); absent = fully revealed (1.0)
   */
  update(visibleNodeIds, currentZoomLevel, focusedNodeId, parentMap, deltaMs) {
    const scales = new Map();
    const isZoomingOut =
      this.#previousZoomLevel !== null &&
      currentZoomLevel < this.#previousZoomLevel;
    this.#previousZoomLevel = currentZoomLevel;

    // Advance existing animations
    for (const [nodeId, anim] of this.#animations) {
      anim.elapsed += deltaMs;
      const effectiveElapsed = anim.elapsed - anim.delay;

      if (effectiveElapsed >= REVEAL_DURATION_MS) {
        this.#animations.delete(nodeId);
        this.#probe?.revealCompleted(nodeId);
        // Scale is 1.0 — omit from map
      } else if (effectiveElapsed > 0) {
        const t = effectiveElapsed / REVEAL_DURATION_MS;
        scales.set(nodeId, REVEAL_START_SCALE + (1 - REVEAL_START_SCALE) * easeOut(t));
      } else {
        // Still in stagger delay
        scales.set(nodeId, REVEAL_START_SCALE);
      }
    }

    // Detect newly visible nodes and start reveals on zoom-out
    if (isZoomingOut) {
      for (const nodeId of visibleNodeIds) {
        if (!this.#previousVisibleNodeIds.has(nodeId) && !this.#animations.has(nodeId)) {
          const distance = computeRevealDistance(nodeId, focusedNodeId, parentMap);
          const delay = distance * REVEAL_STAGGER_MS;
          this.#animations.set(nodeId, { elapsed: 0, delay, distance });
          scales.set(nodeId, REVEAL_START_SCALE);
          this.#probe?.revealStarted(nodeId, distance);
        }
      }
    }

    this.#previousVisibleNodeIds = new Set(visibleNodeIds);
    return scales;
  }
}
