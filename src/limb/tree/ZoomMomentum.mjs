// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Inertial zoom momentum: after a sustained scroll gesture,
 * zoom continues decelerating smoothly via exponential friction.
 *
 * - Friction: velocity halves every 120ms (HALF_LIFE_MS).
 * - Minimum threshold: 0.001 zoom-units/ms.
 * - Tracks last 3 scroll events within a 150ms window.
 * - Single isolated scroll ticks do NOT trigger momentum.
 *
 * See interaction-feel.md S1.1, S1.2.
 */

const HALF_LIFE_MS = 120;
const MIN_VELOCITY = 0.001;
const MAX_EVENTS = 3;
const EVENT_WINDOW_MS = 150;

export class ZoomMomentum {
  /** @type {{ delta: number, time: number }[]} */
  #events = [];
  /** @type {number} */
  #velocity = 0;
  /** @type {boolean} */
  #active = false;
  /** @type {import('../ports/ZoomMomentumProbe').ZoomMomentumProbe | null} */
  #probe = null;

  /**
   * @param {import('../ports/ZoomMomentumProbe').ZoomMomentumProbe} [probe]
   */
  constructor(probe) {
    this.#probe = probe ?? null;
  }

  /** @returns {boolean} */
  get isActive() {
    return this.#active;
  }

  /** @returns {number} Current velocity in zoom-units/ms (absolute value reflects direction via sign). */
  get velocity() {
    return this.#velocity;
  }

  /**
   * Record a scroll event. Cancels any active momentum and starts
   * fresh velocity tracking.
   *
   * @param {number} deltaLevel - Zoom level change from this scroll event.
   * @param {number} timestamp - Event timestamp in ms.
   */
  onScroll(deltaLevel, timestamp) {
    if (this.#active) {
      this.#active = false;
      this.#velocity = 0;
      this.#probe?.momentumCancelled();
    }

    this.#events.push({ delta: deltaLevel, time: timestamp });

    // Keep at most MAX_EVENTS
    if (this.#events.length > MAX_EVENTS) {
      this.#events.shift();
    }

    // Evict events outside the 150ms window of the latest event
    const latestTime = this.#events[this.#events.length - 1].time;
    while (this.#events.length > 0 && latestTime - this.#events[0].time > EVENT_WINDOW_MS) {
      this.#events.shift();
    }
  }

  /**
   * Called when no new scroll events have arrived for 150ms.
   * Computes release velocity and starts momentum if the gesture
   * was sustained (>= 2 events).
   *
   * @param {number} _timestamp - Current time in ms (unused but kept for API consistency).
   */
  onRelease(_timestamp) {
    if (this.#events.length < 2) {
      this.#events = [];
      return;
    }

    const first = this.#events[0];
    const last = this.#events[this.#events.length - 1];
    const timeSpan = last.time - first.time;

    if (timeSpan <= 0) {
      this.#events = [];
      return;
    }

    let totalDelta = 0;
    for (const e of this.#events) {
      totalDelta += e.delta;
    }

    const velocity = totalDelta / timeSpan;

    if (Math.abs(velocity) < MIN_VELOCITY) {
      this.#events = [];
      return;
    }

    this.#velocity = velocity;
    this.#active = true;
    this.#events = [];
    this.#probe?.momentumStarted(velocity);
  }

  /**
   * Advance momentum by deltaMs. Returns the zoom level delta to apply.
   *
   * Uses the exact integral of exponential decay over the interval:
   *   delta = v₀ * (halfLife / ln2) * (1 - 0.5^(dt/halfLife))
   *
   * This ensures the accumulated delta is frame-rate independent.
   *
   * @param {number} deltaMs - Time since last update in ms.
   * @returns {number} Zoom level delta to apply (0 if not active).
   */
  update(deltaMs) {
    if (!this.#active) return 0;

    // Integrate velocity over the interval for the zoom delta
    const decayFactor = Math.pow(0.5, deltaMs / HALF_LIFE_MS);
    const delta = this.#velocity * (HALF_LIFE_MS / Math.LN2) * (1 - decayFactor);

    // Update velocity to end-of-interval value
    this.#velocity *= decayFactor;

    // Check threshold
    if (Math.abs(this.#velocity) < MIN_VELOCITY) {
      this.#active = false;
      this.#velocity = 0;
      this.#probe?.momentumStopped();
    }

    return delta;
  }

  /**
   * Cancel active momentum immediately.
   */
  cancel() {
    if (!this.#active) return;
    this.#active = false;
    this.#velocity = 0;
    this.#probe?.momentumCancelled();
  }
}
