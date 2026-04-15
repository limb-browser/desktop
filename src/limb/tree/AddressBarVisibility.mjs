// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Pure domain model for address bar visibility based on zoom level.
 *
 * Implements ZoomProbe: reacts to zoom changes and computes the
 * address bar's opacity and interactivity state.
 *
 * Opacity mapping (spec navigation.md S2.1):
 * - Below 0.85: 0.0 (hidden)
 * - [0.85, 0.95]: linear interpolation from 0.0 to 1.0
 * - Above 0.95: 1.0 (fully visible)
 *
 * When opacity is 0.0, the address bar is non-interactive
 * (pointer-events: none).
 *
 * Fires AddressBarVisibilityProbe.visibilityChanged on state changes.
 */

const FADE_START = 0.85;
const FADE_END = 0.95;
const AUTO_ZOOM_TARGET = 0.95;

export class AddressBarVisibility {
  /** @type {number} */
  #opacity = 1.0;
  /** @type {boolean} */
  #interactive = true;
  /** @type {{ visibilityChanged(opacity: number, interactive: boolean): void } | null} */
  #probe = null;

  /**
   * @param {{ visibilityChanged(opacity: number, interactive: boolean): void }} [probe]
   */
  constructor(probe) {
    this.#probe = probe ?? null;
  }

  /** @returns {number} Current opacity (0.0 to 1.0) */
  get opacity() {
    return this.#opacity;
  }

  /** @returns {boolean} Whether the address bar accepts pointer events */
  get interactive() {
    return this.#interactive;
  }

  /** @returns {number} The zoom level to set when auto-zooming for Ctrl+L */
  get autoZoomTarget() {
    return AUTO_ZOOM_TARGET;
  }

  /**
   * ZoomProbe implementation. Called when the zoom level changes.
   * @param {number} level - Current zoom level (0.0 to 1.0)
   * @param {number} _zoomScale - Pixels per logical unit (unused)
   */
  zoomChanged(level, _zoomScale) {
    let newOpacity;
    if (level < FADE_START) {
      newOpacity = 0.0;
    } else if (level >= FADE_END) {
      newOpacity = 1.0;
    } else {
      newOpacity = (level - FADE_START) / (FADE_END - FADE_START);
    }

    const newInteractive = newOpacity > 0;

    if (newOpacity !== this.#opacity || newInteractive !== this.#interactive) {
      this.#opacity = newOpacity;
      this.#interactive = newInteractive;
      this.#probe?.visibilityChanged(this.#opacity, this.#interactive);
    }
  }

  /**
   * Whether Ctrl+L should trigger auto-zoom to reveal the address bar.
   * Auto-zoom is needed when the zoom level is below the fade start
   * threshold, meaning the address bar is completely invisible.
   * @param {number} level - Current zoom level
   * @returns {boolean}
   */
  shouldAutoZoom(level) {
    return level < FADE_START;
  }
}
