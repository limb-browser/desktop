// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * @typedef {Object} TabPositionEntry
 * @property {string} nodeId
 * @property {number} x - Screen x (top-left corner)
 * @property {number} y - Screen y (top-left corner)
 * @property {number} width - Screen width in pixels
 * @property {number} height - Screen height in pixels
 */

/**
 * @typedef {Object} ContentDeckTransform
 * @property {string} transform - CSS transform value (empty string to clear)
 * @property {string} width - CSS width value (empty string to clear)
 * @property {string} height - CSS height value (empty string to clear)
 */

/**
 * @typedef {Object} TabPositionFrame
 * @property {TabPositionEntry | null} focusedTab - Fills viewport when tier is 'focused'; null otherwise
 * @property {TabPositionEntry[]} liveTabs - Live-tier tabs positioned at tree coordinates
 * @property {'canvas' | 'tab'} inputMode - Which element receives pointer events
 * @property {Map<string, number>} crossFades - nodeId -> browser element opacity (0 = screenshot visible, 1 = live visible)
 * @property {ContentDeckTransform} contentDeckTransform - CSS transform for #limb-content-deck
 */

const CROSS_FADE_DURATION_MS = 150;

const LIVE_TIERS = new Set(['live', 'focused']);
const SCREENSHOT_TIERS = new Set(['screenshot-low', 'screenshot-high']);

/**
 * Computes per-frame positioning instructions for tab `<browser>` elements
 * based on zoom level, LOD tiers, and layout positions.
 *
 * Pure computation: returns data structures describing what the caller should
 * apply to the DOM (CSS transforms, visibility, pointer-events).
 *
 * Spec references:
 * - tree-rendering.md S3.1: focused tab fills viewport at level >= 0.9
 * - tree-rendering.md S3.2: live non-focused tabs at tree coordinates
 * - zoom-lod.md S3.2: input routing threshold at level 0.9
 * - interaction-feel.md S7.1: cross-fade on tab appearance, no blank flash
 */
export class TabPositioner {
  /** @type {Map<string, { startTime: number, direction: 'to-live' | 'to-screenshot' }>} */
  #crossFades = new Map();
  /** @type {import('../ports/TabPositionerProbe').TabPositionerProbe | null} */
  #probe;
  /** @type {() => number} */
  #now;
  /** @type {'canvas' | 'tab' | null} */
  #lastInputMode = null;

  /**
   * @param {import('../ports/TabPositionerProbe').TabPositionerProbe} [probe]
   * @param {{ now?: () => number }} [options]
   */
  constructor(probe, options) {
    this.#probe = probe ?? null;
    this.#now = options?.now ?? (() => performance.now());
  }

  /**
   * Notify of an LOD tier transition to trigger cross-fade animation tracking.
   *
   * Call after ScreenshotManager has handled the transition (screenshot
   * captured or tab restored) so the cross-fade has valid content to blend.
   *
   * @param {string} nodeId
   * @param {string} previousTier
   * @param {string} newTier
   */
  onTierChanged(nodeId, previousTier, newTier) {
    if (SCREENSHOT_TIERS.has(previousTier) && LIVE_TIERS.has(newTier)) {
      this.#crossFades.set(nodeId, {
        startTime: this.#now(),
        direction: 'to-live',
      });
      this.#probe?.crossFadeStarted(nodeId, 'to-live');
    } else if (LIVE_TIERS.has(previousTier) && SCREENSHOT_TIERS.has(newTier)) {
      this.#crossFades.set(nodeId, {
        startTime: this.#now(),
        direction: 'to-screenshot',
      });
      this.#probe?.crossFadeStarted(nodeId, 'to-screenshot');
    }
  }

  /**
   * Compute positioning instructions for the current frame.
   *
   * @param {{
   *   zoomLevel: number,
   *   viewportSize: { width: number, height: number },
   *   focusedNodeId: string | null,
   *   tiers: Map<string, string>,
   *   nodePositions: Map<string, { x: number, y: number }>,
   *   logicalToScreen: (x: number, y: number) => { x: number, y: number },
   *   baseNodeWidth: number,
   *   baseNodeHeight: number,
   *   zoomScale: number,
   *   maxLiveTabs: number,
   * }} state
   * @returns {TabPositionFrame}
   */
  computeFrame(state) {
    const {
      zoomLevel, viewportSize, focusedNodeId, tiers, nodePositions,
      logicalToScreen, baseNodeWidth, baseNodeHeight, zoomScale, maxLiveTabs,
    } = state;

    const nodeScreenWidth = baseNodeWidth * zoomScale;
    const nodeScreenHeight = baseNodeHeight * zoomScale;

    // --- Input mode ---
    /** @type {'canvas' | 'tab'} */
    const inputMode = zoomLevel >= 0.9 ? 'tab' : 'canvas';

    if (this.#lastInputMode !== null && this.#lastInputMode !== inputMode) {
      this.#probe?.inputModeChanged(inputMode);
    }
    this.#lastInputMode = inputMode;

    // --- Focused tab ---
    /** @type {TabPositionEntry | null} */
    let focusedTab = null;
    let focusedUsesSlot = false;

    if (focusedNodeId) {
      const tier = tiers.get(focusedNodeId);
      if (tier === 'focused') {
        focusedTab = {
          nodeId: focusedNodeId,
          x: 0,
          y: 0,
          width: viewportSize.width,
          height: viewportSize.height,
        };
        focusedUsesSlot = true;
      } else if (tier === 'live') {
        // Focused node at live tier is always active (uses a process slot)
        focusedUsesSlot = true;
      }
    }

    // --- Live tabs ---
    /** @type {TabPositionEntry[]} */
    const liveTabs = [];
    const remainingSlots = Math.max(0, maxLiveTabs - (focusedUsesSlot ? 1 : 0));

    // Add focused node at live tier to liveTabs (positioned at tree coords)
    if (focusedNodeId && !focusedTab) {
      const tier = tiers.get(focusedNodeId);
      if (tier === 'live') {
        const pos = nodePositions.get(focusedNodeId);
        if (pos) {
          const screen = logicalToScreen(pos.x, pos.y);
          liveTabs.push({
            nodeId: focusedNodeId,
            x: screen.x - nodeScreenWidth / 2,
            y: screen.y - nodeScreenHeight / 2,
            width: nodeScreenWidth,
            height: nodeScreenHeight,
          });
        }
      }
    }

    // Add non-focused live tabs up to remaining slots
    let addedNonFocused = 0;
    for (const [nodeId, tier] of tiers) {
      if (nodeId === focusedNodeId) continue;
      if (tier !== 'live') continue;
      if (addedNonFocused >= remainingSlots) break;

      const pos = nodePositions.get(nodeId);
      if (!pos) continue;

      const screen = logicalToScreen(pos.x, pos.y);
      liveTabs.push({
        nodeId,
        x: screen.x - nodeScreenWidth / 2,
        y: screen.y - nodeScreenHeight / 2,
        width: nodeScreenWidth,
        height: nodeScreenHeight,
      });
      addedNonFocused++;
    }

    // --- Cross-fades ---
    const crossFades = /** @type {Map<string, number>} */ (new Map());
    const now = this.#now();
    const completed = [];

    for (const [nodeId, fade] of this.#crossFades) {
      const elapsed = now - fade.startTime;
      const t = Math.min(1, elapsed / CROSS_FADE_DURATION_MS);

      if (fade.direction === 'to-live') {
        crossFades.set(nodeId, t);
      } else {
        crossFades.set(nodeId, 1 - t);
      }

      if (t >= 1) {
        completed.push(nodeId);
      }
    }

    for (const nodeId of completed) {
      this.#crossFades.delete(nodeId);
      this.#probe?.crossFadeCompleted(nodeId);
    }

    // --- Content deck transform ---
    /** @type {ContentDeckTransform} */
    let contentDeckTransform = { transform: '', width: '', height: '' };

    if (zoomLevel < 0.9 && focusedNodeId) {
      const pos = nodePositions.get(focusedNodeId);
      if (pos) {
        const screen = logicalToScreen(pos.x, pos.y);
        const x = screen.x - nodeScreenWidth / 2;
        const y = screen.y - nodeScreenHeight / 2;
        const scale = nodeScreenWidth / viewportSize.width;
        contentDeckTransform = {
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          width: '',
          height: '',
        };
      }
    }

    return { focusedTab, liveTabs, inputMode, crossFades, contentDeckTransform };
  }
}
