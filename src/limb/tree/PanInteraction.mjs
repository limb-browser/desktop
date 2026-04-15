// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Pan interaction handler for click-drag panning when zoomed out.
 *
 * When zoomLevel < 0.9, click-and-drag adjusts the ZoomState focusPoint
 * to pan the viewport. A 5px distance threshold distinguishes clicks
 * from drags (zoom-lod.md S3.3).
 */
export class PanInteraction {
  static DRAG_THRESHOLD = 5;

  /** @type {import('./ZoomState.mjs').ZoomState} */
  #zoomState;
  /** @type {{ x: number, y: number } | null} */
  #startScreen = null;
  /** @type {{ x: number, y: number } | null} */
  #lastScreen = null;
  /** @type {boolean} */
  #isDragging = false;
  /** @type {boolean} */
  #isMouseDown = false;

  /**
   * @param {import('./ZoomState.mjs').ZoomState} zoomState
   */
  constructor(zoomState) {
    this.#zoomState = zoomState;
  }

  /** @returns {boolean} */
  get isPanMode() {
    return this.#zoomState.level < 0.9;
  }

  /** @returns {string} */
  get cursor() {
    if (!this.isPanMode) return "default";
    if (this.#isDragging) return "grabbing";
    return "grab";
  }

  /**
   * @param {number} screenX
   * @param {number} screenY
   */
  onMouseDown(screenX, screenY) {
    if (!this.isPanMode) return;
    this.#isMouseDown = true;
    this.#startScreen = { x: screenX, y: screenY };
    this.#lastScreen = { x: screenX, y: screenY };
  }

  /**
   * @param {number} screenX
   * @param {number} screenY
   * @returns {boolean} true if focusPoint was updated (repaint needed)
   */
  onMouseMove(screenX, screenY) {
    if (!this.#isMouseDown || !this.#startScreen || !this.#lastScreen) {
      return false;
    }

    if (!this.#isDragging) {
      const dx = screenX - this.#startScreen.x;
      const dy = screenY - this.#startScreen.y;
      if (Math.sqrt(dx * dx + dy * dy) <= PanInteraction.DRAG_THRESHOLD) {
        return false;
      }
      this.#isDragging = true;
    }

    const deltaScreenX = screenX - this.#lastScreen.x;
    const deltaScreenY = screenY - this.#lastScreen.y;
    this.#lastScreen = { x: screenX, y: screenY };

    const scale = this.#zoomState.zoomScale;
    this.#zoomState.focusPoint = {
      x: this.#zoomState.focusPoint.x - deltaScreenX / scale,
      y: this.#zoomState.focusPoint.y - deltaScreenY / scale,
    };

    return true;
  }

  /**
   * @returns {boolean} true if this was a click (not a drag)
   */
  onMouseUp() {
    const wasClick = this.#isMouseDown && !this.#isDragging;
    this.#isMouseDown = false;
    this.#isDragging = false;
    this.#startScreen = null;
    this.#lastScreen = null;
    return wasClick;
  }
}
