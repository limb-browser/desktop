// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Inertial pan momentum and boundary damping for tree view panning.
 *
 * After a click-and-drag pan release, the viewport continues moving
 * with decelerating velocity (same friction model as zoom: velocity
 * halves every 120ms). When the viewport center exits the tree
 * bounding box, pan speed is reduced by 80%. On release outside
 * bounds, a 200ms ease-out snap-back animation returns the viewport
 * to the nearest edge. A hard limit ensures at least 20% of the tree
 * bounding box remains visible at all times.
 *
 * See interaction-feel.md S2.
 *
 * @typedef {{ minX: number, minY: number, maxX: number, maxY: number }} TreeBounds
 * @typedef {{ width: number, height: number }} ViewportLogicalSize
 */

/** Friction model: velocity halves every 120ms (S1.1). */
const HALF_LIFE_MS = 120;

/** Momentum stops when velocity magnitude drops below this (logical-units/ms). */
const MIN_VELOCITY = 0.001;

/** Pan speed multiplier when viewport center is outside tree bounds (80% reduction). */
const DAMPING_FACTOR = 0.2;

/** Snap-back animation duration in ms. */
const SNAP_BACK_DURATION_MS = 200;

/** Minimum fraction of tree bounding box that must remain visible per axis. */
const VISIBILITY_RATIO = 0.2;

/** Maximum age of drag samples used for velocity computation (ms). */
const SAMPLE_WINDOW_MS = 150;

/**
 * Quadratic ease-out: t => 1 - (1 - t)^2
 * @param {number} t - Progress [0, 1]
 * @returns {number}
 */
function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

export class PanMomentum {
  /** @type {Array<{ dx: number, dy: number, dt: number }>} */
  #samples = [];
  /** @type {number} Wall-clock timestamp of the most recent drag sample. */
  #lastSampleTime = 0;
  /** @type {number} */
  #vx = 0;
  /** @type {number} */
  #vy = 0;
  /** @type {'idle' | 'momentum' | 'snap-back'} */
  #state = "idle";

  // Snap-back animation state
  /** @type {number} */
  #snapStartX = 0;
  /** @type {number} */
  #snapStartY = 0;
  /** @type {number} */
  #snapTargetX = 0;
  /** @type {number} */
  #snapTargetY = 0;
  /** @type {number} */
  #snapElapsed = 0;

  /** @type {import('../ports/PanMomentumProbe').PanMomentumProbe | null} */
  #probe;

  /**
   * @param {import('../ports/PanMomentumProbe').PanMomentumProbe} [probe]
   */
  constructor(probe) {
    this.#probe = probe ?? null;
  }

  /** @returns {boolean} */
  get isActive() {
    return this.#state !== "idle";
  }

  /**
   * Record a drag sample for velocity computation.
   * Keeps only samples within the recent time window.
   *
   * @param {number} dx - Focus point delta in logical units
   * @param {number} dy - Focus point delta in logical units
   * @param {number} dt - Time delta in ms since last sample
   * @param {number} now - Wall-clock timestamp (e.g., performance.now())
   */
  recordDrag(dx, dy, dt, now) {
    this.#lastSampleTime = now;
    this.#samples.push({ dx, dy, dt });

    // Trim old samples outside the time window
    let total = 0;
    let i = this.#samples.length - 1;
    while (i >= 0) {
      total += this.#samples[i].dt;
      if (total > SAMPLE_WINDOW_MS) break;
      i--;
    }
    if (i >= 0) {
      this.#samples = this.#samples.slice(i + 1);
    }
  }

  /**
   * Start momentum or snap-back on drag release.
   *
   * If focusPoint is outside tree bounds, starts a snap-back animation
   * to the nearest edge. Otherwise, computes velocity from recent drag
   * samples and starts inertial momentum if above the minimum threshold.
   *
   * Stale samples (older than SAMPLE_WINDOW_MS) are discarded before
   * velocity computation to prevent phantom motion when the user holds
   * the mouse still before releasing.
   *
   * @param {{ x: number, y: number }} focusPoint - Current viewport center (logical)
   * @param {TreeBounds} treeBounds - Tree bounding box (logical)
   * @param {number} now - Wall-clock timestamp (e.g., performance.now())
   */
  release(focusPoint, treeBounds, now) {
    // Expire stale samples: if the last recorded sample is older than
    // the time window, the user has visually stopped moving.
    if (this.#samples.length > 0 && now - this.#lastSampleTime > SAMPLE_WINDOW_MS) {
      this.#samples = [];
    }

    const velocity = this.#computeVelocity();
    this.#samples = [];

    if (this.#isOutsideBounds(focusPoint, treeBounds)) {
      this.#beginSnapBack(focusPoint, treeBounds);
      return;
    }

    const speed = Math.sqrt(velocity.vx * velocity.vx + velocity.vy * velocity.vy);
    if (speed < MIN_VELOCITY) {
      return;
    }

    this.#vx = velocity.vx;
    this.#vy = velocity.vy;
    this.#state = "momentum";
    this.#probe?.momentumStarted(this.#vx, this.#vy);
  }

  /**
   * Advance momentum or snap-back by dt milliseconds.
   *
   * Returns the delta to apply to focusPoint and whether the animation
   * is still active. The caller is responsible for applying the delta
   * and calling markDirty() if active.
   *
   * @param {number} dt - Time delta in ms
   * @param {{ x: number, y: number }} focusPoint - Current viewport center (logical)
   * @param {TreeBounds} treeBounds - Tree bounding box (logical)
   * @param {ViewportLogicalSize} viewportLogicalSize - Viewport dimensions in logical units
   * @returns {{ dx: number, dy: number, active: boolean }}
   */
  update(dt, focusPoint, treeBounds, viewportLogicalSize) {
    if (this.#state === "momentum") {
      return this.#updateMomentum(dt, focusPoint, treeBounds, viewportLogicalSize);
    }
    if (this.#state === "snap-back") {
      return this.#updateSnapBack(dt, focusPoint);
    }
    return { dx: 0, dy: 0, active: false };
  }

  /**
   * Cancel any active momentum or snap-back.
   * Also clears accumulated drag samples.
   */
  cancel() {
    if (this.#state !== "idle") {
      this.#state = "idle";
      this.#vx = 0;
      this.#vy = 0;
      this.#probe?.cancelled();
    }
    this.#samples = [];
  }

  /**
   * Apply boundary damping to a pan delta.
   *
   * When the viewport center is outside the tree bounds, the delta
   * is reduced by 80% (multiplied by 0.2). Used during drag.
   *
   * @param {number} dx - Pan delta X (logical units)
   * @param {number} dy - Pan delta Y (logical units)
   * @param {{ x: number, y: number }} focusPoint - Current viewport center before delta
   * @param {TreeBounds} bounds - Tree bounding box
   * @returns {{ dx: number, dy: number }}
   */
  dampDelta(dx, dy, focusPoint, bounds) {
    if (this.#isOutsideBounds(focusPoint, bounds)) {
      return { dx: dx * DAMPING_FACTOR, dy: dy * DAMPING_FACTOR };
    }
    return { dx, dy };
  }

  /**
   * Clamp a focus point to maintain at least 20% tree visibility per axis.
   *
   * The viewport must overlap with at least 20% of the tree's extent
   * in each dimension. Returns the clamped point.
   *
   * @param {{ x: number, y: number }} point - Focus point to clamp
   * @param {TreeBounds} bounds - Tree bounding box
   * @param {ViewportLogicalSize} viewportLogicalSize - Viewport dimensions in logical units
   * @returns {{ x: number, y: number }}
   */
  clampForVisibility(point, bounds, viewportLogicalSize) {
    const treeW = bounds.maxX - bounds.minX;
    const treeH = bounds.maxY - bounds.minY;
    const vpW = viewportLogicalSize.width;
    const vpH = viewportLogicalSize.height;

    const minFocusX = bounds.minX + VISIBILITY_RATIO * treeW - vpW / 2;
    const maxFocusX = bounds.maxX - VISIBILITY_RATIO * treeW + vpW / 2;
    const minFocusY = bounds.minY + VISIBILITY_RATIO * treeH - vpH / 2;
    const maxFocusY = bounds.maxY - VISIBILITY_RATIO * treeH + vpH / 2;

    return {
      x: Math.max(minFocusX, Math.min(maxFocusX, point.x)),
      y: Math.max(minFocusY, Math.min(maxFocusY, point.y)),
    };
  }

  // --- Private ---

  /**
   * @param {number} dt
   * @param {{ x: number, y: number }} focusPoint
   * @param {TreeBounds} treeBounds
   * @param {ViewportLogicalSize} viewportLogicalSize
   * @returns {{ dx: number, dy: number, active: boolean }}
   */
  #updateMomentum(dt, focusPoint, treeBounds, viewportLogicalSize) {
    const decay = Math.pow(0.5, dt / HALF_LIFE_MS);
    const outside = this.#isOutsideBounds(focusPoint, treeBounds);
    const factor = outside ? DAMPING_FACTOR : 1;

    const rawDx = this.#vx * dt * factor;
    const rawDy = this.#vy * dt * factor;

    this.#vx *= decay;
    this.#vy *= decay;

    const clamped = this.clampForVisibility(
      { x: focusPoint.x + rawDx, y: focusPoint.y + rawDy },
      treeBounds,
      viewportLogicalSize,
    );

    const dx = clamped.x - focusPoint.x;
    const dy = clamped.y - focusPoint.y;

    const speed = Math.sqrt(this.#vx * this.#vx + this.#vy * this.#vy);
    if (speed < MIN_VELOCITY) {
      if (this.#isOutsideBounds(clamped, treeBounds)) {
        this.#probe?.momentumStopped();
        this.#beginSnapBack(clamped, treeBounds);
      } else {
        this.#state = "idle";
        this.#probe?.momentumStopped();
      }
    }

    return { dx, dy, active: this.#state !== "idle" };
  }

  /**
   * @param {number} dt
   * @param {{ x: number, y: number }} focusPoint
   * @returns {{ dx: number, dy: number, active: boolean }}
   */
  #updateSnapBack(dt, focusPoint) {
    this.#snapElapsed += dt;
    const t = Math.min(1, this.#snapElapsed / SNAP_BACK_DURATION_MS);
    const eased = easeOut(t);

    const x = this.#snapStartX + (this.#snapTargetX - this.#snapStartX) * eased;
    const y = this.#snapStartY + (this.#snapTargetY - this.#snapStartY) * eased;

    if (t >= 1) {
      this.#state = "idle";
      this.#probe?.snapBackCompleted();
    }

    return { dx: x - focusPoint.x, dy: y - focusPoint.y, active: this.#state !== "idle" };
  }

  /**
   * @param {{ x: number, y: number }} focusPoint
   * @param {TreeBounds} treeBounds
   */
  #beginSnapBack(focusPoint, treeBounds) {
    this.#snapStartX = focusPoint.x;
    this.#snapStartY = focusPoint.y;
    this.#snapTargetX = Math.max(treeBounds.minX, Math.min(treeBounds.maxX, focusPoint.x));
    this.#snapTargetY = Math.max(treeBounds.minY, Math.min(treeBounds.maxY, focusPoint.y));
    this.#snapElapsed = 0;
    this.#vx = 0;
    this.#vy = 0;
    this.#state = "snap-back";
    this.#probe?.snapBackStarted(this.#snapTargetX, this.#snapTargetY);
  }

  /**
   * Compute average velocity from recent drag samples.
   * @returns {{ vx: number, vy: number }}
   */
  #computeVelocity() {
    if (this.#samples.length === 0) return { vx: 0, vy: 0 };

    let totalDx = 0;
    let totalDy = 0;
    let totalDt = 0;
    for (const s of this.#samples) {
      totalDx += s.dx;
      totalDy += s.dy;
      totalDt += s.dt;
    }

    if (totalDt <= 0) return { vx: 0, vy: 0 };
    return { vx: totalDx / totalDt, vy: totalDy / totalDt };
  }

  /**
   * @param {{ x: number, y: number }} point
   * @param {TreeBounds} bounds
   * @returns {boolean}
   */
  #isOutsideBounds(point, bounds) {
    return (
      point.x < bounds.minX ||
      point.x > bounds.maxX ||
      point.y < bounds.minY ||
      point.y > bounds.maxY
    );
  }
}
