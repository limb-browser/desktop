// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { computeIntermediateZoomLevel } from "./ZoomOutAndBackAnimator.mjs";

/**
 * Handles new-child-creation zoom behavior for navigation.md S1.1 steps 5-6.
 *
 * Contains the zoom threshold gate (>= 0.9 triggers animation).
 * When zoomed in, starts a zoom-out-and-back animation on the provided animator.
 * When zoomed out (< 0.9), signals the caller to center on the new child.
 */
export class NewChildZoomHandler {
  /** @type {import('./ZoomOutAndBackAnimator.mjs').ZoomOutAndBackAnimator} */
  #animator;

  /**
   * @param {import('./ZoomOutAndBackAnimator.mjs').ZoomOutAndBackAnimator} animator
   */
  constructor(animator) {
    this.#animator = animator;
  }

  /**
   * Decide how to handle a new child node being created.
   *
   * - If zoom >= 0.9: starts the zoom-out-and-back animation on the animator
   *   and returns 'animated'.
   * - If zoom < 0.9: returns 'centered' (caller should center on child).
   * - If positions are missing: returns 'skipped'.
   *
   * @param {object} ctx
   * @param {number} ctx.zoomLevel - Current zoom level (0.0 to 1.0)
   * @param {{ x: number, y: number } | undefined} ctx.parentPos
   * @param {{ x: number, y: number } | undefined} ctx.childPos
   * @param {{ width: number, height: number }} ctx.viewportSize
   * @param {{ width: number, height: number }} ctx.treeExtent
   * @param {{ x: number, y: number }} ctx.currentFocus - Current viewport focus point
   * @param {number} ctx.nodeWidth - Node width in logical units
   * @param {number} ctx.nodeHeight - Node height in logical units
   * @returns {'animated' | 'centered' | 'skipped'}
   */
  handle(ctx) {
    if (!ctx.parentPos || !ctx.childPos) return "skipped";

    if (ctx.zoomLevel < 0.9) {
      return "centered";
    }

    const holdLevel = computeIntermediateZoomLevel(
      ctx.parentPos, ctx.childPos,
      ctx.viewportSize, ctx.treeExtent,
      ctx.nodeWidth, ctx.nodeHeight,
    );
    const holdFocus = {
      x: (ctx.parentPos.x + ctx.childPos.x) / 2,
      y: (ctx.parentPos.y + ctx.childPos.y) / 2,
    };

    this.#animator.start(
      ctx.zoomLevel, holdLevel, 1.0,
      { ...ctx.currentFocus }, holdFocus, { x: ctx.childPos.x, y: ctx.childPos.y },
    );

    return "animated";
  }
}
