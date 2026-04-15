// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Periodic memory snapshot collector for performance observability.
 *
 * Collects heap size, screenshot memory usage, and tab count every 30 seconds
 * and reports via the PerformanceProbe interface (performance.md S6.1).
 */

const SNAPSHOT_INTERVAL_MS = 30000;

export class PerformanceMonitor {
  /** @type {import('../ports/PerformanceProbe').PerformanceProbe} */
  #probe;
  /** @type {() => { heapMB: number, screenshotsMB: number, tabCount: number }} */
  #getSnapshot;
  /** @type {(fn: () => void, ms: number) => number} */
  #setInterval;
  /** @type {(id: number) => void} */
  #clearInterval;
  /** @type {number | null} */
  #timerId = null;

  /**
   * @param {import('../ports/PerformanceProbe').PerformanceProbe} probe
   * @param {() => { heapMB: number, screenshotsMB: number, tabCount: number }} getSnapshot
   * @param {{ setInterval?: (fn: () => void, ms: number) => number, clearInterval?: (id: number) => void }} [options]
   */
  constructor(probe, getSnapshot, options) {
    this.#probe = probe;
    this.#getSnapshot = getSnapshot;
    this.#setInterval = options?.setInterval ?? globalThis.setInterval;
    this.#clearInterval = options?.clearInterval ?? globalThis.clearInterval;
  }

  install() {
    if (this.#timerId !== null) return;
    this.#timerId = this.#setInterval(() => {
      const { heapMB, screenshotsMB, tabCount } = this.#getSnapshot();
      this.#probe.memorySnapshot(heapMB, screenshotsMB, tabCount);
    }, SNAPSHOT_INTERVAL_MS);
  }

  uninstall() {
    if (this.#timerId === null) return;
    this.#clearInterval(this.#timerId);
    this.#timerId = null;
  }
}
