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
 * Zoom model (see zoom-lod.md S1):
 * - level 0.0: entire tree fits in viewport
 * - level 1.0: focused node fills viewport width
 * - Ctrl+Scroll adjusts level with cursor-anchored zoom
 *
 * Loaded in the browser chrome context via browser.xhtml.
 */

// Zoom level change per 100px of wheel deltaY
const ZOOM_SENSITIVITY = 0.05;

export class LimbTreeView {
  /** @type {HTMLCanvasElement | null} */
  #canvas = null;
  /** @type {CanvasRenderingContext2D | null} */
  #ctx = null;
  /** @type {boolean} */
  #initialized = false;

  // Zoom state (domain math matches ZoomState.ts)
  /** @type {number} Zoom level clamped to [0.0, 1.0] */
  #zoomLevel = 0;
  /** @type {{ x: number, y: number }} Center of viewport in logical coordinates */
  #focusPoint = { x: 0, y: 0 };
  /** @type {{ width: number, height: number }} Logical extent of the tree */
  #treeExtent = { width: 1, height: 1 };

  /** @type {((e: WheelEvent) => void) | null} */
  #wheelHandler = null;
  /** @type {(() => void) | null} */
  #resizeHandler = null;

  /**
   * Initialize the tree view with a canvas element.
   * @param {HTMLCanvasElement} canvas
   */
  init(canvas) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext("2d");
    this.#initialized = true;

    this.#resizeHandler = () => this.#resize();
    this.#wheelHandler = (e) => this.#onWheel(e);

    this.#resize();
    this.#paint();

    window.addEventListener("resize", this.#resizeHandler);
    window.addEventListener("wheel", this.#wheelHandler, { passive: false });
  }

  #resize() {
    if (!this.#canvas) return;
    this.#canvas.width = window.innerWidth;
    this.#canvas.height = window.innerHeight;
    this.#paint();
  }

  /**
   * Handle wheel events. Ctrl+Scroll adjusts zoom with cursor anchoring.
   * @param {WheelEvent} e
   */
  #onWheel(e) {
    if (!e.ctrlKey) return;
    e.preventDefault();

    const deltaLevel = -(e.deltaY / 100) * ZOOM_SENSITIVITY;
    this.#zoomAtCursor(deltaLevel, e.clientX, e.clientY);
    this.#paint();
  }

  // -- Zoom math (mirrors ZoomState.ts, tested there) --

  get #viewportSize() {
    return {
      width: this.#canvas?.width ?? 0,
      height: this.#canvas?.height ?? 0,
    };
  }

  get #maxScale() {
    return this.#viewportSize.width;
  }

  get #minScale() {
    const vp = this.#viewportSize;
    const ext = this.#treeExtent;
    const sx = vp.width / Math.max(ext.width, 1);
    const sy = vp.height / Math.max(ext.height, 1);
    return Math.min(sx, sy);
  }

  get #zoomScale() {
    const min = this.#minScale;
    const max = this.#maxScale;
    if (min >= max) return max;
    return min * Math.pow(max / min, this.#zoomLevel);
  }

  /**
   * @param {number} x logical
   * @param {number} y logical
   * @returns {{ x: number, y: number }} screen
   */
  #logicalToScreen(x, y) {
    const scale = this.#zoomScale;
    const vp = this.#viewportSize;
    return {
      x: (x - this.#focusPoint.x) * scale + vp.width / 2,
      y: (y - this.#focusPoint.y) * scale + vp.height / 2,
    };
  }

  /**
   * @param {number} x screen
   * @param {number} y screen
   * @returns {{ x: number, y: number }} logical
   */
  #screenToLogical(x, y) {
    const scale = this.#zoomScale;
    const vp = this.#viewportSize;
    return {
      x: (x - vp.width / 2) / scale + this.#focusPoint.x,
      y: (y - vp.height / 2) / scale + this.#focusPoint.y,
    };
  }

  /**
   * Zoom by deltaLevel with cursor anchoring.
   * @param {number} deltaLevel
   * @param {number} cursorScreenX
   * @param {number} cursorScreenY
   */
  #zoomAtCursor(deltaLevel, cursorScreenX, cursorScreenY) {
    const logical = this.#screenToLogical(cursorScreenX, cursorScreenY);
    this.#zoomLevel = Math.max(0, Math.min(1, this.#zoomLevel + deltaLevel));
    const newScale = this.#zoomScale;
    const vp = this.#viewportSize;
    this.#focusPoint = {
      x: logical.x - (cursorScreenX - vp.width / 2) / newScale,
      y: logical.y - (cursorScreenY - vp.height / 2) / newScale,
    };
  }

  /**
   * Update the tree extent (called when the tree changes).
   * @param {{ width: number, height: number }} extent
   */
  setTreeExtent(extent) {
    this.#treeExtent = { ...extent };
    this.#paint();
  }

  #paint() {
    if (!this.#ctx || !this.#canvas) return;
    const ctx = this.#ctx;
    const w = this.#canvas.width;
    const h = this.#canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w, h);

    // Apply zoom transform: logical coordinates → screen coordinates
    ctx.save();
    const scale = this.#zoomScale;
    const cx = w / 2 - this.#focusPoint.x * scale;
    const cy = h / 2 - this.#focusPoint.y * scale;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Placeholder: draw grid lines at logical integer positions
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 1 / scale;
    const ext = this.#treeExtent;
    for (let x = 0; x < ext.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x, -0.5);
      ctx.lineTo(x, ext.height - 0.5);
      ctx.stroke();
    }
    for (let y = 0; y < ext.height; y++) {
      ctx.beginPath();
      ctx.moveTo(-0.5, y);
      ctx.lineTo(ext.width - 0.5, y);
      ctx.stroke();
    }

    ctx.restore();

    // HUD: zoom level indicator
    ctx.fillStyle = "#555";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      `Zoom: ${(this.#zoomLevel * 100).toFixed(0)}%  Scale: ${this.#zoomScale.toFixed(1)}px/unit`,
      8,
      h - 8,
    );
  }

  destroy() {
    if (this.#resizeHandler) {
      window.removeEventListener("resize", this.#resizeHandler);
    }
    if (this.#wheelHandler) {
      window.removeEventListener("wheel", this.#wheelHandler);
    }
    this.#canvas = null;
    this.#ctx = null;
    this.#initialized = false;
    this.#resizeHandler = null;
    this.#wheelHandler = null;
  }

  get isInitialized() {
    return this.#initialized;
  }
}
