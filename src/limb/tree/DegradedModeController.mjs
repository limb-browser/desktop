// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Frame budget enforcement with graceful degradation (interaction-feel.md S6).
 *
 * Tracks a rolling window of frame durations and manages degraded mode:
 * - Enters degraded mode when 3 of the last 5 frames exceed 16ms.
 * - Exits degraded mode after 10 consecutive frames under 12ms.
 *
 * When degraded, the system should:
 * 1. Skip long-running animations to final state.
 * 2. Raise LOD tier thresholds (more screenshots, fewer live views).
 */

const WINDOW_SIZE = 5;
const ENTRY_THRESHOLD_MS = 16;
const ENTRY_COUNT = 3;
const EXIT_THRESHOLD_MS = 12;
const EXIT_COUNT = 10;

export class DegradedModeController {
  /** @type {number[]} */
  #window = [];
  /** @type {boolean} */
  #degraded = false;
  /** @type {number} */
  #consecutiveFastFrames = 0;
  /** @type {import('../ports/PerformanceProbe').PerformanceProbe | null} */
  #probe;

  /**
   * @param {import('../ports/PerformanceProbe').PerformanceProbe} [probe]
   */
  constructor(probe) {
    this.#probe = probe ?? null;
  }

  /** @returns {boolean} */
  get isDegraded() {
    return this.#degraded;
  }

  /**
   * Record a frame's total duration and update degraded mode state.
   *
   * @param {number} durationMs - Total frame duration from start of tick to end of paint.
   */
  recordFrameDuration(durationMs) {
    this.#window.push(durationMs);
    if (this.#window.length > WINDOW_SIZE) {
      this.#window.shift();
    }

    if (!this.#degraded) {
      // Check entry condition: 3 of last 5 exceed 16ms
      const slowCount = this.#window.filter(d => d > ENTRY_THRESHOLD_MS).length;
      if (slowCount >= ENTRY_COUNT) {
        this.#degraded = true;
        this.#consecutiveFastFrames = 0;
        this.#probe?.degradedModeEntered();
      }
    } else {
      // Check exit condition: 10 consecutive frames under 12ms
      if (durationMs < EXIT_THRESHOLD_MS) {
        this.#consecutiveFastFrames++;
        if (this.#consecutiveFastFrames >= EXIT_COUNT) {
          this.#degraded = false;
          this.#consecutiveFastFrames = 0;
          this.#probe?.degradedModeExited();
        }
      } else {
        this.#consecutiveFastFrames = 0;
      }
    }
  }
}
