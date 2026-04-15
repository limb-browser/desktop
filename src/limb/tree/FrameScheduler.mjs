// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Demand-driven frame scheduler for the tree renderer.
 *
 * Instead of running an unconditional 60fps loop, this scheduler only
 * runs frames when something has changed. After 30 consecutive idle
 * frames (~500ms at 60fps), it stops scheduling entirely and resumes
 * on the next markDirty() call.
 *
 * See performance.md S3.3.
 */

import { DegradedModeController } from './DegradedModeController.mjs';

const IDLE_FRAME_LIMIT = 30;
const FRAME_BUDGET_MS = 16;

export class FrameScheduler {
  /** @type {boolean} */
  #dirty = false;
  /** @type {number} */
  #idleFrameCount = 0;
  /** @type {boolean} */
  #running = false;
  /** @type {number | null} */
  #frameId = null;
  /** @type {() => void} */
  #paint;
  /** @type {(cb: () => void) => number} */
  #requestFrame;
  /** @type {(id: number) => void} */
  #cancelFrame;
  /** @type {import('../ports/FrameSchedulerProbe').FrameSchedulerProbe | null} */
  #probe;
  /** @type {import('../ports/PerformanceProbe').PerformanceProbe | null} */
  #performanceProbe;
  /** @type {() => number} */
  #now;
  /** @type {DegradedModeController} */
  #degradedMode;

  /**
   * @param {() => void} paint - The paint callback to invoke each frame.
   * @param {import('../ports/FrameSchedulerProbe').FrameSchedulerProbe} [probe]
   * @param {{ requestFrame?: (cb: () => void) => number, cancelFrame?: (id: number) => void, performanceProbe?: import('../ports/PerformanceProbe').PerformanceProbe, now?: () => number }} [options]
   */
  constructor(paint, probe, options) {
    this.#paint = paint;
    this.#probe = probe ?? null;
    this.#requestFrame = options?.requestFrame ?? requestAnimationFrame;
    this.#cancelFrame = options?.cancelFrame ?? cancelAnimationFrame;
    this.#performanceProbe = options?.performanceProbe ?? null;
    this.#now = options?.now ?? (() => performance.now());
    this.#degradedMode = new DegradedModeController(options?.performanceProbe);
  }

  /** @returns {boolean} */
  get isDegraded() {
    return this.#degradedMode.isDegraded;
  }

  /**
   * Signal that a repaint is needed. If the loop is stopped,
   * this resumes it.
   */
  markDirty() {
    this.#dirty = true;
    if (!this.#running) {
      this.#running = true;
      this.#idleFrameCount = 0;
      this.#probe?.loopStarted();
      this.#scheduleFrame();
    }
  }

  #scheduleFrame() {
    this.#frameId = this.#requestFrame(() => this.#tick());
  }

  #tick() {
    this.#frameId = null;

    if (this.#dirty) {
      this.#dirty = false;
      this.#idleFrameCount = 0;
      const start = this.#now();
      this.#paint();
      const elapsed = this.#now() - start;
      if (elapsed > FRAME_BUDGET_MS) {
        this.#performanceProbe?.frameBudgetExceeded(elapsed, FRAME_BUDGET_MS);
      }
      this.#degradedMode.recordFrameDuration(elapsed);
      this.#probe?.framePainted();
    } else {
      this.#idleFrameCount++;
    }

    if (this.#idleFrameCount >= IDLE_FRAME_LIMIT) {
      this.#running = false;
      this.#probe?.loopStopped();
      return;
    }

    this.#scheduleFrame();
  }

  destroy() {
    if (this.#frameId !== null) {
      this.#cancelFrame(this.#frameId);
      this.#frameId = null;
    }
    this.#running = false;
  }
}
