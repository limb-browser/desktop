// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * @typedef {{ level: number, focusPoint: { x: number, y: number }, done: boolean }} AnimationFrame
 */

const ANIMATION_DURATION = 350; // ms

// cubic-bezier(0.25, 0.1, 0.25, 1.0) control points
const BEZ_X1 = 0.25;
const BEZ_Y1 = 0.1;
const BEZ_X2 = 0.25;
const BEZ_Y2 = 1.0;

/**
 * Evaluate the cubic-bezier(0.25, 0.1, 0.25, 1.0) easing curve.
 *
 * Given a time fraction t in [0, 1], returns the eased progress value.
 * Uses Newton's method to invert the x(s) parametric curve, then
 * evaluates y(s) at the solved parameter.
 *
 * @param {number} t - Time fraction (0 to 1)
 * @returns {number} Eased value (0 to 1)
 */
export function cubicBezierEaseOut(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  // Find s such that x(s) = t using Newton's method
  let s = t; // initial guess
  for (let i = 0; i < 8; i++) {
    const x = bezierX(s) - t;
    const dx = bezierDX(s);
    if (Math.abs(dx) < 1e-12) break;
    s -= x / dx;
  }

  // Clamp s and fall back to bisection if Newton diverged
  if (s < 0 || s > 1) {
    let lo = 0;
    let hi = 1;
    s = t;
    for (let i = 0; i < 20; i++) {
      const x = bezierX(s);
      if (Math.abs(x - t) < 1e-8) break;
      if (x < t) {
        lo = s;
      } else {
        hi = s;
      }
      s = (lo + hi) / 2;
    }
  }

  return bezierY(s);
}

/**
 * @param {number} s
 * @returns {number}
 */
function bezierX(s) {
  return 3 * (1 - s) * (1 - s) * s * BEZ_X1 +
    3 * (1 - s) * s * s * BEZ_X2 +
    s * s * s;
}

/**
 * @param {number} s
 * @returns {number}
 */
function bezierY(s) {
  return 3 * (1 - s) * (1 - s) * s * BEZ_Y1 +
    3 * (1 - s) * s * s * BEZ_Y2 +
    s * s * s;
}

/**
 * Derivative of x(s) with respect to s.
 * @param {number} s
 * @returns {number}
 */
function bezierDX(s) {
  return 3 * BEZ_X1 * (1 - s) * (1 - 3 * s) +
    3 * BEZ_X2 * s * (2 - 3 * s) +
    3 * s * s;
}

/**
 * Animates zoom level and focus point using cubic-bezier ease-out timing.
 *
 * Duration: 350ms. Easing: cubic-bezier(0.25, 0.1, 0.25, 1.0)
 * per interaction-feel.md S1.3.
 *
 * Implements the ZoomAnimationProbe port for observability.
 */
export class ZoomAnimator {
  /** @type {number} */
  #startLevel = 0;
  /** @type {number} */
  #endLevel = 1;
  /** @type {number} */
  #startFocusX = 0;
  /** @type {number} */
  #startFocusY = 0;
  /** @type {number} */
  #endFocusX = 0;
  /** @type {number} */
  #endFocusY = 0;
  /** @type {number} */
  #elapsed = 0;
  /** @type {boolean} */
  #active = false;
  /** @type {{ animationStarted(fromLevel: number, toLevel: number): void, animationCompleted(): void, animationCancelled(): void } | null} */
  #probe = null;

  /**
   * @param {{ animationStarted(fromLevel: number, toLevel: number): void, animationCompleted(): void, animationCancelled(): void }} [probe]
   */
  constructor(probe) {
    this.#probe = probe ?? null;
  }

  /** @returns {boolean} */
  get isAnimating() {
    return this.#active;
  }

  /**
   * Start a zoom animation. If an animation is already running, it is
   * cancelled first.
   *
   * @param {number} fromLevel
   * @param {number} toLevel
   * @param {{ x: number, y: number }} fromFocusPoint
   * @param {{ x: number, y: number }} toFocusPoint
   */
  start(fromLevel, toLevel, fromFocusPoint, toFocusPoint) {
    if (this.#active) {
      this.#active = false;
      this.#probe?.animationCancelled();
    }

    this.#startLevel = fromLevel;
    this.#endLevel = toLevel;
    this.#startFocusX = fromFocusPoint.x;
    this.#startFocusY = fromFocusPoint.y;
    this.#endFocusX = toFocusPoint.x;
    this.#endFocusY = toFocusPoint.y;
    this.#elapsed = 0;
    this.#active = true;
    this.#probe?.animationStarted(fromLevel, toLevel);
  }

  /**
   * Cancel any running animation.
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
   * @returns {AnimationFrame | null} Current interpolated state, or null if not animating.
   */
  update(deltaMs) {
    if (!this.#active) return null;

    this.#elapsed += deltaMs;
    const t = Math.min(1, this.#elapsed / ANIMATION_DURATION);
    const eased = cubicBezierEaseOut(t);

    const level = this.#startLevel + (this.#endLevel - this.#startLevel) * eased;
    const focusPoint = {
      x: this.#startFocusX + (this.#endFocusX - this.#startFocusX) * eased,
      y: this.#startFocusY + (this.#endFocusY - this.#startFocusY) * eased,
    };

    const done = t >= 1;
    if (done) {
      this.#active = false;
      this.#probe?.animationCompleted();
    }

    return { level, focusPoint, done };
  }
}
