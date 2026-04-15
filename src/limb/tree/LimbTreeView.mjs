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

import { ZoomState } from "./ZoomState.mjs";

// Zoom level change per 100px of wheel deltaY
const ZOOM_SENSITIVITY = 0.05;

export class LimbTreeView {
  /** @type {HTMLCanvasElement | null} */
  #canvas = null;
  /** @type {CanvasRenderingContext2D | null} */
  #ctx = null;
  /** @type {boolean} */
  #initialized = false;

  /** @type {ZoomState | null} */
  #zoom = null;

  /** @type {((e: WheelEvent) => void) | null} */
  #wheelHandler = null;
  /** @type {(() => void) | null} */
  #resizeHandler = null;

  /**
   * Initialize the tree view with a canvas element.
   * @param {HTMLCanvasElement} canvas
   * @param {{ zoomChanged(level: number, zoomScale: number): void }} [probe]
   */
  init(canvas, probe) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext("2d");
    this.#initialized = true;

    this.#zoom = new ZoomState(
      { width: canvas.width, height: canvas.height },
      { width: 1, height: 1 },
      probe,
    );

    this.#resizeHandler = () => this.#resize();
    this.#wheelHandler = (e) => this.#onWheel(e);

    this.#resize();
    this.#paint();

    window.addEventListener("resize", this.#resizeHandler);
    this.#canvas.addEventListener("wheel", this.#wheelHandler, { passive: false });
  }

  #resize() {
    if (!this.#canvas || !this.#zoom) return;
    this.#canvas.width = window.innerWidth;
    this.#canvas.height = window.innerHeight;
    this.#zoom.viewportSize = {
      width: this.#canvas.width,
      height: this.#canvas.height,
    };
    this.#paint();
  }

  /**
   * Handle wheel events. Ctrl+Scroll adjusts zoom with cursor anchoring.
   * @param {WheelEvent} e
   */
  #onWheel(e) {
    if (!e.ctrlKey || !this.#zoom) return;
    e.preventDefault();

    const deltaLevel = -(e.deltaY / 100) * ZOOM_SENSITIVITY;
    this.#zoom.zoomAtCursor(deltaLevel, e.clientX, e.clientY);
    this.#paint();
  }

  /**
   * Update the tree extent (called when the tree changes).
   * @param {{ width: number, height: number }} extent
   */
  setTreeExtent(extent) {
    if (!this.#zoom) return;
    this.#zoom.treeExtent = { ...extent };
    this.#paint();
  }

  #paint() {
    if (!this.#ctx || !this.#canvas || !this.#zoom) return;
    const ctx = this.#ctx;
    const w = this.#canvas.width;
    const h = this.#canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w, h);

    // Apply zoom transform: logical coordinates → screen coordinates
    ctx.save();
    const scale = this.#zoom.zoomScale;
    const cx = w / 2 - this.#zoom.focusPoint.x * scale;
    const cy = h / 2 - this.#zoom.focusPoint.y * scale;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Placeholder: draw grid lines at logical integer positions
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 1 / scale;
    const ext = this.#zoom.treeExtent;
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
      `Zoom: ${(this.#zoom.level * 100).toFixed(0)}%  Scale: ${this.#zoom.zoomScale.toFixed(1)}px/unit`,
      8,
      h - 8,
    );
  }

  destroy() {
    if (this.#resizeHandler) {
      window.removeEventListener("resize", this.#resizeHandler);
    }
    if (this.#wheelHandler && this.#canvas) {
      this.#canvas.removeEventListener("wheel", this.#wheelHandler);
    }
    this.#canvas = null;
    this.#ctx = null;
    this.#initialized = false;
    this.#zoom = null;
    this.#resizeHandler = null;
    this.#wheelHandler = null;
  }

  get isInitialized() {
    return this.#initialized;
  }
}
