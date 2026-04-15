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
import { TreeRenderer } from "./TreeRenderer.mjs";
import { LODComputer } from "./LODComputer.mjs";

// Zoom level change per 100px of wheel deltaY
const ZOOM_SENSITIVITY = 0.05;

// Default node sizing in logical units
const BASE_NODE_WIDTH = 0.8;
const BASE_NODE_HEIGHT = 0.6;
const NODE_CORNER_RADIUS_RATIO = 0.05; // fraction of node width

// Visual fill colors per LOD tier
const TIER_COLORS = {
  "favicon": "#2a2a2a",
  "screenshot-low": "#2a3a2a",
  "screenshot-high": "#2a2a3a",
  "live": "#3a3a2a",
  "focused": "#2a3a3a",
};

export class LimbTreeView {
  /** @type {HTMLCanvasElement | null} */
  #canvas = null;
  /** @type {CanvasRenderingContext2D | null} */
  #ctx = null;
  /** @type {boolean} */
  #initialized = false;

  /** @type {ZoomState | null} */
  #zoom = null;
  /** @type {TreeRenderer | null} */
  #renderer = null;
  /** @type {LODComputer | null} */
  #lodComputer = null;

  /** @type {Map<string, { x: number, y: number }> | null} */
  #positions = null;
  /** @type {Map<string, string> | null} */
  #parentMap = null;
  /** @type {string | null} */
  #focusedNodeId = null;
  /** @type {Map<string, string> | null} */
  #tiers = null;

  /** @type {((e: WheelEvent) => void) | null} */
  #wheelHandler = null;
  /** @type {(() => void) | null} */
  #resizeHandler = null;

  /**
   * Initialize the tree view with a canvas element.
   * @param {HTMLCanvasElement} canvas
   * @param {{ zoomChanged(level: number, zoomScale: number): void }} [probe]
   * @param {{ tierChanged(nodeId: string, previousTier: string, newTier: string): void }} [lodProbe]
   */
  init(canvas, probe, lodProbe) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext("2d");
    this.#initialized = true;

    this.#zoom = new ZoomState(
      { width: canvas.width, height: canvas.height },
      { width: 1, height: 1 },
      probe,
    );

    this.#renderer = new TreeRenderer(BASE_NODE_WIDTH, BASE_NODE_HEIGHT);
    this.#lodComputer = new LODComputer(BASE_NODE_WIDTH, BASE_NODE_HEIGHT, lodProbe);

    this.#resizeHandler = () => this.#resize();
    this.#wheelHandler = (e) => this.#onWheel(e);

    this.#resize();
    this.#paint();

    window.addEventListener("resize", this.#resizeHandler);
    this.#canvas.addEventListener("wheel", this.#wheelHandler, { passive: false });
  }

  /**
   * Set the tree data for rendering.
   * @param {Map<string, { x: number, y: number }>} positions - Logical node positions from TreeLayout
   * @param {Map<string, string>} parentMap - childId -> parentId mapping
   * @param {{ width: number, height: number }} treeExtent - Bounding extent of the tree
   * @param {string} [focusedNodeId] - ID of the currently focused node (for LOD computation)
   */
  setTreeData(positions, parentMap, treeExtent, focusedNodeId) {
    this.#positions = positions;
    this.#parentMap = parentMap;
    this.#focusedNodeId = focusedNodeId ?? null;
    if (this.#zoom) {
      this.#zoom.treeExtent = { ...treeExtent };
    }
    this.#paint();
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

  #paint() {
    if (!this.#ctx || !this.#canvas || !this.#zoom || !this.#renderer) return;
    const ctx = this.#ctx;
    const w = this.#canvas.width;
    const h = this.#canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w, h);

    if (this.#positions && this.#parentMap) {
      const zoom = this.#zoom;

      // Compute LOD tiers for all nodes
      if (this.#lodComputer) {
        this.#tiers = this.#lodComputer.computeTiers(
          { focusedNodeId: this.#focusedNodeId },
          this.#positions,
          zoom,
        );
      }

      const frame = this.#renderer.computeFrame(
        this.#positions,
        this.#parentMap,
        (lx, ly) => zoom.logicalToScreen(lx, ly),
        zoom.zoomScale,
        w,
        h,
      );

      // Paint edges as cubic Bezier curves
      ctx.strokeStyle = "#666";
      ctx.lineWidth = Math.max(1, Math.min(2, zoom.zoomScale * 0.01));
      for (const edge of frame.edges) {
        const midY = (edge.startY + edge.endY) / 2;
        ctx.beginPath();
        ctx.moveTo(edge.startX, edge.startY);
        ctx.bezierCurveTo(
          edge.startX, midY,
          edge.endX, midY,
          edge.endX, edge.endY,
        );
        ctx.stroke();
      }

      // Paint node rectangles, colored by LOD tier
      const cornerRadius = Math.max(2, frame.nodes[0]?.width * NODE_CORNER_RADIUS_RATIO || 2);
      ctx.lineWidth = 1;
      for (const node of frame.nodes) {
        const tier = this.#tiers?.get(node.nodeId);
        if (tier === "culled") continue;

        ctx.fillStyle = TIER_COLORS[tier] ?? "#2a2a2a";
        ctx.strokeStyle = tier === "focused" ? "#88f" : "#444";
        const r = Math.min(cornerRadius, node.width / 2, node.height / 2);
        ctx.beginPath();
        ctx.roundRect(node.x, node.y, node.width, node.height, r);
        ctx.fill();
        ctx.stroke();
      }
    }

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
    this.#renderer = null;
    this.#lodComputer = null;
    this.#positions = null;
    this.#parentMap = null;
    this.#focusedNodeId = null;
    this.#tiers = null;
    this.#resizeHandler = null;
    this.#wheelHandler = null;
  }

  get isInitialized() {
    return this.#initialized;
  }
}
