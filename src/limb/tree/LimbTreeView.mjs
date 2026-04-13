// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * LimbTreeView - Canvas-based tree renderer for Firefox chrome.
 *
 * This is the main entry point for Limb's tree visualization.
 * It renders the browsing tree on a Canvas 2D context and manages
 * the zoom/pan interaction layer.
 *
 * Loaded in the browser chrome context via browser.xhtml.
 */

export class LimbTreeView {
  /** @type {HTMLCanvasElement | null} */
  #canvas = null;
  /** @type {CanvasRenderingContext2D | null} */
  #ctx = null;
  /** @type {boolean} */
  #initialized = false;

  /**
   * Initialize the tree view with a canvas element.
   * @param {HTMLCanvasElement} canvas
   */
  init(canvas) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext("2d");
    this.#initialized = true;
    this.#resize();
    this.#paint();

    // Resize canvas when window resizes
    window.addEventListener("resize", () => this.#resize());
  }

  #resize() {
    if (!this.#canvas) return;
    this.#canvas.width = window.innerWidth;
    this.#canvas.height = window.innerHeight;
    this.#paint();
  }

  #paint() {
    if (!this.#ctx || !this.#canvas) return;
    const ctx = this.#ctx;
    const w = this.#canvas.width;
    const h = this.#canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w, h);

    // Placeholder: draw a simple indicator that the tree view is active
    ctx.fillStyle = "#333";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Limb Tree View", w / 2, h / 2);
    ctx.fillStyle = "#555";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("Tree rendering will be wired here", w / 2, h / 2 + 24);
  }

  destroy() {
    this.#canvas = null;
    this.#ctx = null;
    this.#initialized = false;
  }

  get isInitialized() {
    return this.#initialized;
  }
}
