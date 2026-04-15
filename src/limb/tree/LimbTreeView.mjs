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
import { PanInteraction } from "./PanInteraction.mjs";
import { NodeLabelComputer } from "./NodeLabelComputer.mjs";
import { HoverInteraction } from "./HoverInteraction.mjs";
import { hitTestNodes } from "./HitTester.mjs";
import { ZoomAnimator } from "./ZoomAnimator.mjs";
import { FrameScheduler } from "./FrameScheduler.mjs";

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

// Focus ring accent color and width
const FOCUS_RING_COLOR = "#5588ff";
const FOCUS_RING_WIDTH = 2;

// Hover visual offset (pixels upward)
const HOVER_OFFSET_Y = 2;

// Viewport animation duration in milliseconds
const ANIMATION_DURATION_MS = 300;

// Ease-out for hover interpolation: t => 1 - (1 - t)^2
function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

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
  /** @type {PanInteraction | null} */
  #panInteraction = null;
  /** @type {NodeLabelComputer | null} */
  #labelComputer = null;
  /** @type {HoverInteraction | null} */
  #hoverInteraction = null;
  /** @type {ZoomAnimator | null} */
  #zoomAnimator = null;
  /** @type {FrameScheduler | null} */
  #frameScheduler = null;

  /** @type {import('./HitTester.mjs').NodeRect[]} */
  #lastFrameNodes = [];
  /** @type {number} */
  #animationLastTime = 0;
  /** @type {((nodeId: string) => void) | null} */
  #onNodeClicked = null;

  /** @type {Map<string, { x: number, y: number }> | null} */
  #positions = null;
  /** @type {Map<string, string> | null} */
  #parentMap = null;
  /** @type {string | null} */
  #focusedNodeId = null;
  /** @type {Map<string, string> | null} */
  #tiers = null;
  /** @type {Map<string, string>} nodeId -> title */
  #titles = new Map();
  /** @type {number} */
  #lastFrameTime = 0;

  // Animation state for pan-only viewport transitions (centerOnNode)
  /** @type {{ startFocus: { x: number, y: number }, endFocus: { x: number, y: number }, startLevel: number, endLevel: number, startTime: number, duration: number } | null} */
  #animation = null;

  /** @type {((e: WheelEvent) => void) | null} */
  #wheelHandler = null;
  /** @type {(() => void) | null} */
  #resizeHandler = null;
  /** @type {((e: MouseEvent) => void) | null} */
  #mousedownHandler = null;
  /** @type {((e: MouseEvent) => void) | null} */
  #mousemoveHandler = null;
  /** @type {((e: MouseEvent) => void) | null} */
  #mouseupHandler = null;

  /**
   * Initialize the tree view with a canvas element.
   * @param {HTMLCanvasElement} canvas
   * @param {{ zoomChanged(level: number, zoomScale: number): void }} [probe]
   * @param {{ tierChanged(nodeId: string, previousTier: string, newTier: string): void }} [lodProbe]
   * @param {{ onNodeClicked?: (nodeId: string) => void, animationProbe?: import('../ports/ZoomAnimationProbe').ZoomAnimationProbe, frameSchedulerProbe?: import('../ports/FrameSchedulerProbe').FrameSchedulerProbe }} [options]
   */
  init(canvas, probe, lodProbe, options) {
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
    this.#panInteraction = new PanInteraction(this.#zoom);
    this.#labelComputer = new NodeLabelComputer();
    this.#hoverInteraction = new HoverInteraction();
    this.#zoomAnimator = new ZoomAnimator(options?.animationProbe);
    this.#onNodeClicked = options?.onNodeClicked ?? null;
    this.#frameScheduler = new FrameScheduler(
      () => this.#onFrame(),
      options?.frameSchedulerProbe,
    );

    this.#resizeHandler = () => this.#resize();
    this.#wheelHandler = (e) => this.#onWheel(e);
    this.#mousedownHandler = (e) => this.#onMouseDown(e);
    this.#mousemoveHandler = (e) => this.#onMouseMove(e);
    this.#mouseupHandler = (e) => this.#onMouseUp(e);

    this.#resize();

    window.addEventListener("resize", this.#resizeHandler);
    this.#canvas.addEventListener("wheel", this.#wheelHandler, { passive: false });
    this.#canvas.addEventListener("mousedown", this.#mousedownHandler);
    this.#canvas.addEventListener("mousemove", this.#mousemoveHandler);
    this.#canvas.addEventListener("mouseup", this.#mouseupHandler);
  }

  /**
   * Set the zoom level programmatically.
   * Used by the address bar adapter to auto-zoom on Ctrl+L.
   * @param {number} level - Target zoom level (0.0 to 1.0)
   */
  setZoomLevel(level) {
    if (!this.#zoom) return;
    this.#zoom.setLevel(level);
    this.#frameScheduler?.markDirty();
  }

  /**
   * @returns {number} Current zoom level (0.0 to 1.0)
   */
  get zoomLevel() {
    return this.#zoom?.level ?? 0;
  }

  /**
   * Update the focused node ID for LOD and focus ring computation.
   * Call this before centerOnNode when the focused node changes
   * outside of setTreeData (e.g., keyboard navigation).
   * @param {string} nodeId
   */
  setFocusedNodeId(nodeId) {
    this.#focusedNodeId = nodeId;
    this.#frameScheduler?.markDirty();
  }

  /**
   * Animate the viewport to center on the given node without changing zoom level.
   * Uses requestAnimationFrame with ease-out interpolation.
   * @param {string} nodeId
   */
  centerOnNode(nodeId) {
    if (!this.#zoom || !this.#positions) return;
    const pos = this.#positions.get(nodeId);
    if (!pos) return;
    this.#startAnimation({ x: pos.x, y: pos.y }, this.#zoom.level);
  }

  /**
   * Animate both zoom level and viewport focus to a node.
   * Used for Ctrl+1 and Escape zoom-to-focused-node.
   * @param {string} nodeId
   * @param {number} targetLevel
   */
  animateToNode(nodeId, targetLevel) {
    if (!this.#zoom || !this.#positions || !this.#zoomAnimator) return;
    const pos = this.#positions.get(nodeId);
    if (!pos) return;

    this.#zoomAnimator.start(
      this.#zoom.level,
      targetLevel,
      { ...this.#zoom.focusPoint },
      { x: pos.x, y: pos.y },
    );

    this.#startAnimationLoop();
  }

  /**
   * Set the tree data for rendering.
   * @param {Map<string, { x: number, y: number }>} positions - Logical node positions from TreeLayout
   * @param {Map<string, string>} parentMap - childId -> parentId mapping
   * @param {{ width: number, height: number }} treeExtent - Bounding extent of the tree
   * @param {string} [focusedNodeId] - ID of the currently focused node (for LOD computation)
   * @param {Map<string, string>} [titles] - nodeId -> title mapping for labels
   */
  setTreeData(positions, parentMap, treeExtent, focusedNodeId, titles) {
    this.#positions = positions;
    this.#parentMap = parentMap;
    this.#focusedNodeId = focusedNodeId ?? null;
    if (titles) {
      this.#titles = titles;
    }
    if (this.#zoom) {
      this.#zoom.treeExtent = { ...treeExtent };
    }
    this.#frameScheduler?.markDirty();
  }

  #resize() {
    if (!this.#canvas || !this.#zoom) return;
    this.#canvas.width = window.innerWidth;
    this.#canvas.height = window.innerHeight;
    this.#zoom.viewportSize = {
      width: this.#canvas.width,
      height: this.#canvas.height,
    };
    this.#frameScheduler?.markDirty();
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
    this.#updateCursor();
    this.#frameScheduler?.markDirty();
  }

  /** @param {MouseEvent} e */
  #onMouseDown(e) {
    if (!this.#panInteraction) return;
    this.#panInteraction.onMouseDown(e.clientX, e.clientY);
    this.#updateCursor();
  }

  /** @param {MouseEvent} e */
  #onMouseMove(e) {
    if (!this.#panInteraction) return;
    if (this.#panInteraction.onMouseMove(e.clientX, e.clientY)) {
      this.#updateCursor();
      this.#frameScheduler?.markDirty();
      return;
    }
    // Track hover position when not dragging
    if (this.#hoverInteraction) {
      this.#hoverInteraction.setMousePosition(e.clientX, e.clientY);
      this.#frameScheduler?.markDirty();
    }
  }

  /** @param {MouseEvent} e */
  #onMouseUp(e) {
    if (!this.#panInteraction) return;
    const wasClick = this.#panInteraction.onMouseUp();
    this.#updateCursor();

    if (wasClick && this.#zoom && this.#zoom.level < 0.9) {
      this.#handleClickToFocus(e.clientX, e.clientY);
    }
  }

  /**
   * Handle a click on the canvas for click-to-focus behavior.
   * Hit-tests against last rendered node rects, then starts a zoom
   * animation to the clicked node if found.
   *
   * @param {number} screenX
   * @param {number} screenY
   */
  #handleClickToFocus(screenX, screenY) {
    const clickedNodeId = hitTestNodes(screenX, screenY, this.#lastFrameNodes);
    if (!clickedNodeId || !this.#zoom || !this.#positions || !this.#zoomAnimator) return;

    // Notify external listener (e.g., BrowsingTree.focusNode)
    this.#onNodeClicked?.(clickedNodeId);
    this.#focusedNodeId = clickedNodeId;

    // Get the clicked node's logical position for the animation target
    const targetPos = this.#positions.get(clickedNodeId);
    if (!targetPos) return;

    this.#zoomAnimator.start(
      this.#zoom.level,
      1.0,
      { ...this.#zoom.focusPoint },
      { x: targetPos.x, y: targetPos.y },
    );

    this.#startAnimationLoop();
  }

  /**
   * Start a zoom animation via the ZoomAnimator.
   * Cancels any in-progress pan animation and kicks the frame scheduler.
   */
  #startAnimationLoop() {
    this.#animation = null;
    this.#animationLastTime = performance.now();
    this.#frameScheduler?.markDirty();
  }

  #updateCursor() {
    if (!this.#canvas || !this.#panInteraction) return;
    this.#canvas.style.cursor = this.#panInteraction.cursor;
  }

  /**
   * Unified frame callback invoked by the FrameScheduler.
   * Advances any active animations, then paints.
   */
  #onFrame() {
    const now = performance.now();

    // Advance ZoomAnimator if active
    if (this.#zoomAnimator?.isAnimating && this.#zoom) {
      const deltaMs = now - this.#animationLastTime;
      const frame = this.#zoomAnimator.update(deltaMs);
      if (frame) {
        this.#zoom.setLevel(frame.level);
        this.#zoom.focusPoint = { ...frame.focusPoint };
        if (!frame.done) {
          this.#frameScheduler?.markDirty();
        }
      }
    }

    // Advance pan animation if active
    if (this.#animation && this.#zoom) {
      const elapsed = now - this.#animation.startTime;
      const rawT = Math.min(1, elapsed / this.#animation.duration);
      const t = easeOut(rawT);

      this.#zoom.focusPoint = {
        x: this.#animation.startFocus.x + (this.#animation.endFocus.x - this.#animation.startFocus.x) * t,
        y: this.#animation.startFocus.y + (this.#animation.endFocus.y - this.#animation.startFocus.y) * t,
      };
      if (this.#animation.startLevel !== this.#animation.endLevel) {
        this.#zoom.setLevel(
          this.#animation.startLevel + (this.#animation.endLevel - this.#animation.startLevel) * t,
        );
      }

      if (rawT < 1) {
        this.#frameScheduler?.markDirty();
      } else {
        this.#animation = null;
      }
    }

    this.#animationLastTime = now;
    this.#paint();
  }

  #paint() {
    if (!this.#ctx || !this.#canvas || !this.#zoom || !this.#renderer) return;
    const ctx = this.#ctx;
    const w = this.#canvas.width;
    const h = this.#canvas.height;
    const now = performance.now();
    const deltaMs = this.#lastFrameTime > 0 ? now - this.#lastFrameTime : 0;
    this.#lastFrameTime = now;

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
        this.#focusedNodeId,
      );

      // Store for hit testing on click
      this.#lastFrameNodes = frame.nodes;

      // Compute hover state
      let hoverProgress = new Map();
      if (this.#hoverInteraction && zoom.level < 0.9) {
        const hoverState = this.#hoverInteraction.update(frame.nodes, deltaMs);
        hoverProgress = hoverState.hoverProgress;
      }

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

        // Compute hover offset
        const rawProgress = hoverProgress.get(node.nodeId) ?? 0;
        const progress = easeOut(rawProgress);
        const offsetY = -HOVER_OFFSET_Y * progress;

        ctx.fillStyle = TIER_COLORS[tier] ?? "#2a2a2a";
        ctx.strokeStyle = tier === "focused" ? "#88f" : "#444";
        const r = Math.min(cornerRadius, node.width / 2, node.height / 2);
        ctx.beginPath();
        ctx.roundRect(node.x, node.y + offsetY, node.width, node.height, r);
        ctx.fill();
        ctx.stroke();
      }

      // Paint focus ring
      if (frame.focusRing) {
        const rawProgress = hoverProgress.get(frame.focusRing.nodeId) ?? 0;
        const progress = easeOut(rawProgress);
        const offsetY = -HOVER_OFFSET_Y * progress;
        ctx.strokeStyle = FOCUS_RING_COLOR;
        ctx.lineWidth = FOCUS_RING_WIDTH;
        const r = Math.min(cornerRadius, frame.focusRing.width / 2, frame.focusRing.height / 2);
        ctx.beginPath();
        ctx.roundRect(
          frame.focusRing.x,
          frame.focusRing.y + offsetY,
          frame.focusRing.width,
          frame.focusRing.height,
          r,
        );
        ctx.stroke();
      }

      // Paint labels
      if (this.#labelComputer) {
        /** @type {(text: string, fontSize: number) => number} */
        const measureText = (text, fontSize) => {
          ctx.font = `${fontSize}px system-ui, sans-serif`;
          return ctx.measureText(text).width;
        };
        const labels = this.#labelComputer.computeLabels(
          frame.nodes,
          this.#titles,
          measureText,
        );
        ctx.textAlign = "center";
        for (const label of labels) {
          const rawProgress = hoverProgress.get(label.nodeId) ?? 0;
          const progress = easeOut(rawProgress);
          // Opacity: from 70% default to 100% on hover
          const opacity = label.opacity + (1 - label.opacity) * progress;
          const offsetY = -HOVER_OFFSET_Y * progress;
          ctx.globalAlpha = opacity;
          ctx.fillStyle = "#ccc";
          ctx.font = `${label.fontSize}px system-ui, sans-serif`;
          ctx.fillText(label.text, label.x, label.y + offsetY);
        }
        ctx.globalAlpha = 1;
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

  /**
   * Start an animated transition to the target focus point and zoom level.
   * @param {{ x: number, y: number }} targetFocus
   * @param {number} targetLevel
   */
  #startAnimation(targetFocus, targetLevel) {
    if (!this.#zoom) return;
    this.#zoomAnimator?.cancel();
    this.#animation = {
      startFocus: { ...this.#zoom.focusPoint },
      endFocus: targetFocus,
      startLevel: this.#zoom.level,
      endLevel: targetLevel,
      startTime: performance.now(),
      duration: ANIMATION_DURATION_MS,
    };
    this.#frameScheduler?.markDirty();
  }

  destroy() {
    if (this.#resizeHandler) {
      window.removeEventListener("resize", this.#resizeHandler);
    }
    if (this.#canvas) {
      if (this.#wheelHandler) {
        this.#canvas.removeEventListener("wheel", this.#wheelHandler);
      }
      if (this.#mousedownHandler) {
        this.#canvas.removeEventListener("mousedown", this.#mousedownHandler);
      }
      if (this.#mousemoveHandler) {
        this.#canvas.removeEventListener("mousemove", this.#mousemoveHandler);
      }
      if (this.#mouseupHandler) {
        this.#canvas.removeEventListener("mouseup", this.#mouseupHandler);
      }
    }
    if (this.#frameScheduler) {
      this.#frameScheduler.destroy();
    }
    this.#canvas = null;
    this.#ctx = null;
    this.#initialized = false;
    this.#zoom = null;
    this.#renderer = null;
    this.#lodComputer = null;
    this.#panInteraction = null;
    this.#labelComputer = null;
    this.#hoverInteraction = null;
    this.#zoomAnimator = null;
    this.#frameScheduler = null;
    this.#positions = null;
    this.#parentMap = null;
    this.#focusedNodeId = null;
    this.#tiers = null;
    this.#titles = new Map();
    this.#lastFrameTime = 0;
    this.#lastFrameNodes = [];
    this.#animation = null;
    this.#animationLastTime = 0;
    this.#onNodeClicked = null;
    this.#resizeHandler = null;
    this.#wheelHandler = null;
    this.#mousedownHandler = null;
    this.#mousemoveHandler = null;
    this.#mouseupHandler = null;
  }

  get isInitialized() {
    return this.#initialized;
  }
}
