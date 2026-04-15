// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { cubicBezierEaseOut } from "./ZoomAnimator.mjs";

/**
 * @typedef {'zoom-out' | 'hold' | 'zoom-in'} ZoomOutAndBackPhase
 * @typedef {{ level: number, focusPoint: { x: number, y: number }, phase: ZoomOutAndBackPhase, done: boolean }} ZoomOutAndBackFrame
 */

// Phase durations per navigation.md S1.1 / task-040
const ZOOM_OUT_DURATION = 200;  // ms
const HOLD_DURATION = 150;      // ms
const ZOOM_IN_DURATION = 250;   // ms

/**
 * Compute the intermediate zoom level that makes both parent and child
 * visible with comfortable padding.
 *
 * Uses the ZoomState exponential scale formula to determine the zoom level
 * where the viewport covers both nodes.
 *
 * @param {{ x: number, y: number }} parentPos - Parent node position
 * @param {{ x: number, y: number }} childPos - Child node position
 * @param {{ width: number, height: number }} viewportSize - Viewport dimensions in pixels
 * @param {{ width: number, height: number }} treeExtent - Tree bounding box in logical units
 * @param {number} nodeWidth - Node width in logical units
 * @param {number} nodeHeight - Node height in logical units
 * @returns {number} Intermediate zoom level, clamped to [0.3, 0.75]
 */
export function computeIntermediateZoomLevel(parentPos, childPos, viewportSize, treeExtent, nodeWidth, nodeHeight) {
  const dx = Math.abs(parentPos.x - childPos.x);
  const dy = Math.abs(parentPos.y - childPos.y);

  // Required viewport coverage: distance + padding (2 node widths/heights)
  const requiredWidth = dx + 2 * nodeWidth;
  const requiredHeight = dy + 2 * nodeHeight;

  // Required zoom scale to fit both nodes
  const maxScaleForWidth = viewportSize.width / requiredWidth;
  const maxScaleForHeight = viewportSize.height / requiredHeight;
  const requiredScale = Math.min(maxScaleForWidth, maxScaleForHeight);

  // Convert scale to level using inverse of ZoomState exponential formula
  const maxScale = viewportSize.width;
  const minScaleX = viewportSize.width / Math.max(treeExtent.width, 1);
  const minScaleY = viewportSize.height / Math.max(treeExtent.height, 1);
  const minScale = Math.min(minScaleX, minScaleY);

  if (minScale >= maxScale) return 0.65;

  const level = Math.log(requiredScale / minScale) / Math.log(maxScale / minScale);
  return Math.max(0.3, Math.min(0.75, level));
}

/**
 * Orchestrates a three-phase zoom animation for showing new branch creation:
 *
 * Phase 1 (zoom-out): Animate from current zoom to an intermediate level
 *   where both parent and new child are visible. 200ms, ease-out.
 * Phase 2 (hold): Brief pause at intermediate level so user sees the branch.
 *   150ms, no interpolation.
 * Phase 3 (zoom-in): Animate from intermediate to target level centered on
 *   the new child node. 250ms, ease-out.
 *
 * Total: ~600ms.
 *
 * Implements ZoomOutAndBackProbe port for observability.
 */
export class ZoomOutAndBackAnimator {
  /** @type {number} */
  #fromLevel = 0;
  /** @type {number} */
  #holdLevel = 0;
  /** @type {number} */
  #toLevel = 0;
  /** @type {{ x: number, y: number }} */
  #fromFocus = { x: 0, y: 0 };
  /** @type {{ x: number, y: number }} */
  #holdFocus = { x: 0, y: 0 };
  /** @type {{ x: number, y: number }} */
  #toFocus = { x: 0, y: 0 };
  /** @type {number} */
  #elapsed = 0;
  /** @type {boolean} */
  #active = false;
  /** @type {ZoomOutAndBackPhase} */
  #currentPhase = 'zoom-out';
  /** @type {import('../ports/ZoomOutAndBackProbe').ZoomOutAndBackProbe | null} */
  #probe = null;

  /**
   * @param {import('../ports/ZoomOutAndBackProbe').ZoomOutAndBackProbe} [probe]
   */
  constructor(probe) {
    this.#probe = probe ?? null;
  }

  /** @returns {boolean} */
  get isAnimating() {
    return this.#active;
  }

  /**
   * The final target state. Used by callers to jump to the end on cancel.
   * @returns {{ level: number, focusPoint: { x: number, y: number } }}
   */
  get finalState() {
    return {
      level: this.#toLevel,
      focusPoint: { x: this.#toFocus.x, y: this.#toFocus.y },
    };
  }

  /**
   * Start the three-phase zoom-out-and-back animation.
   *
   * @param {number} fromLevel - Current zoom level (~1.0)
   * @param {number} holdLevel - Intermediate zoom level (~0.6-0.7)
   * @param {number} toLevel - Target zoom level (1.0)
   * @param {{ x: number, y: number }} fromFocus - Current focus point (parent node)
   * @param {{ x: number, y: number }} holdFocus - Midpoint focus (between parent and child)
   * @param {{ x: number, y: number }} toFocus - Target focus point (child node)
   */
  start(fromLevel, holdLevel, toLevel, fromFocus, holdFocus, toFocus) {
    if (this.#active) {
      this.#active = false;
      this.#probe?.animationCancelled();
    }

    this.#fromLevel = fromLevel;
    this.#holdLevel = holdLevel;
    this.#toLevel = toLevel;
    this.#fromFocus = { x: fromFocus.x, y: fromFocus.y };
    this.#holdFocus = { x: holdFocus.x, y: holdFocus.y };
    this.#toFocus = { x: toFocus.x, y: toFocus.y };
    this.#elapsed = 0;
    this.#active = true;
    this.#currentPhase = 'zoom-out';

    this.#probe?.animationStarted(fromLevel, holdLevel, toLevel);
    this.#probe?.phaseChanged('zoom-out');
  }

  /**
   * Cancel the animation.
   */
  cancel() {
    if (this.#active) {
      this.#active = false;
      this.#probe?.animationCancelled();
    }
  }

  /**
   * Advance the animation by deltaMs milliseconds.
   *
   * @param {number} deltaMs
   * @returns {ZoomOutAndBackFrame | null}
   */
  update(deltaMs) {
    if (!this.#active) return null;

    this.#elapsed += deltaMs;

    /** @type {number} */
    let level;
    /** @type {{ x: number, y: number }} */
    let focusPoint;
    /** @type {ZoomOutAndBackPhase} */
    let phase;
    /** @type {boolean} */
    let done = false;

    const totalDuration = ZOOM_OUT_DURATION + HOLD_DURATION + ZOOM_IN_DURATION;

    if (this.#elapsed < ZOOM_OUT_DURATION) {
      // Phase 1: zoom out
      phase = 'zoom-out';
      const t = Math.min(1, this.#elapsed / ZOOM_OUT_DURATION);
      const eased = cubicBezierEaseOut(t);
      level = this.#fromLevel + (this.#holdLevel - this.#fromLevel) * eased;
      focusPoint = {
        x: this.#fromFocus.x + (this.#holdFocus.x - this.#fromFocus.x) * eased,
        y: this.#fromFocus.y + (this.#holdFocus.y - this.#fromFocus.y) * eased,
      };
    } else if (this.#elapsed < ZOOM_OUT_DURATION + HOLD_DURATION) {
      // Phase 2: hold
      phase = 'hold';
      level = this.#holdLevel;
      focusPoint = { x: this.#holdFocus.x, y: this.#holdFocus.y };
    } else {
      // Phase 3: zoom in
      phase = 'zoom-in';
      const phaseElapsed = this.#elapsed - ZOOM_OUT_DURATION - HOLD_DURATION;
      const t = Math.min(1, phaseElapsed / ZOOM_IN_DURATION);
      const eased = cubicBezierEaseOut(t);
      level = this.#holdLevel + (this.#toLevel - this.#holdLevel) * eased;
      focusPoint = {
        x: this.#holdFocus.x + (this.#toFocus.x - this.#holdFocus.x) * eased,
        y: this.#holdFocus.y + (this.#toFocus.y - this.#holdFocus.y) * eased,
      };

      if (this.#elapsed >= totalDuration) {
        level = this.#toLevel;
        focusPoint = { x: this.#toFocus.x, y: this.#toFocus.y };
        done = true;
      }
    }

    // Fire phase change probes
    if (phase !== this.#currentPhase) {
      this.#currentPhase = phase;
      this.#probe?.phaseChanged(phase);
    }

    if (done) {
      this.#active = false;
      this.#probe?.animationCompleted();
    }

    return { level, focusPoint, phase, done };
  }
}
