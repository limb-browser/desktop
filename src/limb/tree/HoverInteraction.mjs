// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * @typedef {{ nodeId: string, x: number, y: number, width: number, height: number }} NodeRect
 * @typedef {{ hoveredNodeId: string | null, hoverProgress: Map<string, number> }} HoverState
 */

const TRANSITION_DURATION = 100; // ms

/**
 * Hover interaction handler for tree nodes.
 *
 * Tracks mouse position, hit-tests against node rectangles, and
 * manages per-node hover animation progress (0 to 1 over 100ms).
 * (interaction-feel.md S3.1)
 */
export class HoverInteraction {
  /** @type {number} */
  #mouseX = -1;
  /** @type {number} */
  #mouseY = -1;
  /** @type {Map<string, number>} nodeId -> progress (0-1) */
  #hoverProgress = new Map();
  /** @type {string | null} */
  #hoveredNodeId = null;

  /**
   * Set the current mouse position.
   * @param {number} screenX
   * @param {number} screenY
   */
  setMousePosition(screenX, screenY) {
    this.#mouseX = screenX;
    this.#mouseY = screenY;
  }

  /**
   * Hit-test mouse position against node rects.
   * @param {NodeRect[]} nodeRects
   * @returns {string | null} hovered nodeId
   */
  hitTest(nodeRects) {
    for (const rect of nodeRects) {
      if (
        this.#mouseX >= rect.x &&
        this.#mouseX <= rect.x + rect.width &&
        this.#mouseY >= rect.y &&
        this.#mouseY <= rect.y + rect.height
      ) {
        return rect.nodeId;
      }
    }
    return null;
  }

  /**
   * Update hover animation state.
   *
   * @param {NodeRect[]} nodeRects - Current visible node rects
   * @param {number} deltaMs - Time since last update in milliseconds
   * @returns {HoverState}
   */
  update(nodeRects, deltaMs) {
    const hoveredNodeId = this.hitTest(nodeRects);
    this.#hoveredNodeId = hoveredNodeId;

    const rate = deltaMs / TRANSITION_DURATION;

    // Advance progress for hovered node
    if (hoveredNodeId) {
      const current = this.#hoverProgress.get(hoveredNodeId) ?? 0;
      this.#hoverProgress.set(hoveredNodeId, Math.min(1, current + rate));
    }

    // Decay progress for non-hovered nodes
    for (const [nodeId, progress] of this.#hoverProgress) {
      if (nodeId !== hoveredNodeId) {
        const newProgress = Math.max(0, progress - rate);
        if (newProgress <= 0) {
          this.#hoverProgress.delete(nodeId);
        } else {
          this.#hoverProgress.set(nodeId, newProgress);
        }
      }
    }

    return {
      hoveredNodeId,
      hoverProgress: new Map(this.#hoverProgress),
    };
  }

  /** @returns {string | null} */
  get hoveredNodeId() {
    return this.#hoveredNodeId;
  }
}
