// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Preload threshold: a screenshot-high node (300-600px) must exceed this
 * width before it becomes a preload candidate. Matches the live exit
 * threshold (450px) so preloading starts as the user zooms into the
 * upper range of screenshot-high.
 */
const PRELOAD_THRESHOLD = 450;

const LIVE_TIERS = new Set(['live', 'focused']);

/**
 * Decides which tab to proactively warm up before it crosses the Live
 * threshold. Limited to one concurrent preload (performance.md S4.2).
 *
 * Call `evaluate()` each frame after LOD tiers are computed. It returns
 * the node ID whose tab should be restored, or null if no preload is
 * needed. The caller is responsible for actually restoring/suspending
 * the tab via the TabPort.
 */
export class TabPreloader {
  /** @type {string | null} */
  #preloadNodeId = null;
  /** @type {import('../ports/TabPreloaderProbe').TabPreloaderProbe | null} */
  #probe;

  /**
   * @param {import('../ports/TabPreloaderProbe').TabPreloaderProbe} [probe]
   */
  constructor(probe) {
    this.#probe = probe ?? null;
  }

  /**
   * Evaluate which node (if any) should be preloaded.
   *
   * @param {Map<string, string>} tiers - Current LOD tier per node
   * @param {number} nodeScreenWidth - Shared screen width for all nodes
   * @returns {string | null} Node ID to preload, or null
   */
  evaluate(tiers, nodeScreenWidth) {
    // Check if current preload is still valid
    if (this.#preloadNodeId !== null) {
      const tier = tiers.get(this.#preloadNodeId);
      if (tier === 'screenshot-high') {
        // Still in screenshot-high — keep preloading, budget occupied
        return this.#preloadNodeId;
      }
      // Node left screenshot-high tier
      const ended = this.#preloadNodeId;
      this.#preloadNodeId = null;
      if (LIVE_TIERS.has(tier)) {
        this.#probe?.preloadCompleted(ended);
      } else {
        this.#probe?.preloadCancelled(ended);
      }
    }

    // Don't start preload if below threshold (strict >)
    if (nodeScreenWidth <= PRELOAD_THRESHOLD) {
      return null;
    }

    // Find a screenshot-high node to preload
    for (const [nodeId, tier] of tiers) {
      if (tier === 'screenshot-high') {
        this.#preloadNodeId = nodeId;
        this.#probe?.preloadStarted(nodeId);
        return nodeId;
      }
    }

    return null;
  }

  /**
   * @returns {string | null} Currently preloading node ID, or null
   */
  get preloadNodeId() {
    return this.#preloadNodeId;
  }
}
