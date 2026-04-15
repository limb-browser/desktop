// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Screenshot resolutions per LOD tier (tree-rendering.md S3.3, zoom-lod.md S2.1).
 * Low-res: 320px wide, JPEG quality 60.
 * High-res: 1024px wide, JPEG quality 85.
 */
const SCREENSHOT_RESOLUTIONS = {
  'screenshot-low': { width: 320, quality: 60 },
  'screenshot-high': { width: 1024, quality: 85 },
};

const LIVE_TIERS = new Set(['live', 'focused']);
const SCREENSHOT_TIERS = new Set(['screenshot-low', 'screenshot-high']);

/**
 * Manages screenshot capture, storage, and tab lifecycle on LOD tier transitions.
 *
 * When a tab transitions from Live/Focused to a Screenshot tier:
 *   1. Captures a screenshot at the appropriate resolution.
 *   2. Stores it in memory (keyed by node ID and resolution).
 *   3. Suspends the tab.
 *
 * When a tab transitions from a Screenshot tier to Live/Focused:
 *   1. Restores the tab (reload from URL or SessionStore cache).
 *
 * Preload budget (performance.md S4.2): only one concurrent tab restore at a time.
 */
export class ScreenshotManager {
  /** @type {Map<string, { width: number, height: number }>} key = `${nodeId}:${resolution}` */
  #screenshots = new Map();
  /** @type {{ capture(tab: any, width: number, quality: number): Promise<{ width: number, height: number }> }} */
  #capturePort;
  /** @type {{ suspendTab(tab: any): Promise<void>, restoreTab(tab: any): Promise<void> }} */
  #tabPort;
  /** @type {(nodeId: string) => any} */
  #getTabForNode;
  /** @type {{ screenshotCaptured(nodeId: string, resolution: 'low' | 'high'): void, tabSuspended(nodeId: string): void, tabRestored(nodeId: string): void, preloadStarted(nodeId: string): void, preloadFinished(nodeId: string): void } | null} */
  #probe;
  /** @type {number} */
  #preloading = 0;

  /**
   * @param {{ capture(tab: any, width: number, quality: number): Promise<{ width: number, height: number }> }} capturePort
   * @param {{ suspendTab(tab: any): Promise<void>, restoreTab(tab: any): Promise<void> }} tabPort
   * @param {(nodeId: string) => any} getTabForNode
   * @param {{ screenshotCaptured(nodeId: string, resolution: 'low' | 'high'): void, tabSuspended(nodeId: string): void, tabRestored(nodeId: string): void, preloadStarted(nodeId: string): void, preloadFinished(nodeId: string): void }} [probe]
   */
  constructor(capturePort, tabPort, getTabForNode, probe) {
    this.#capturePort = capturePort;
    this.#tabPort = tabPort;
    this.#getTabForNode = getTabForNode;
    this.#probe = probe ?? null;
  }

  /**
   * Handle an LOD tier transition for a node.
   *
   * @param {string} nodeId
   * @param {string} previousTier
   * @param {string} newTier
   */
  async onTierChanged(nodeId, previousTier, newTier) {
    if (LIVE_TIERS.has(previousTier) && SCREENSHOT_TIERS.has(newTier)) {
      await this.#captureAndSuspend(nodeId, newTier);
    } else if (SCREENSHOT_TIERS.has(previousTier) && LIVE_TIERS.has(newTier)) {
      await this.#restoreTab(nodeId);
    }
  }

  /**
   * Capture a screenshot of a tab's content and store it.
   *
   * @param {string} nodeId
   * @param {'low' | 'high'} resolution - 'low' (320px, quality 60) or 'high' (1024px, quality 85)
   */
  async captureScreenshot(nodeId, resolution) {
    const tab = this.#getTabForNode(nodeId);
    if (!tab) return;

    const tier = resolution === 'low' ? 'screenshot-low' : 'screenshot-high';
    const res = SCREENSHOT_RESOLUTIONS[tier];
    const image = await this.#capturePort.capture(tab, res.width, res.quality);
    this.#screenshots.set(`${nodeId}:${resolution}`, image);
    this.#probe?.screenshotCaptured(nodeId, resolution);
  }

  /**
   * Capture a screenshot and suspend the tab.
   *
   * @param {string} nodeId
   * @param {string} tier - 'screenshot-low' or 'screenshot-high'
   */
  async #captureAndSuspend(nodeId, tier) {
    const resolution = tier === 'screenshot-low' ? 'low' : 'high';
    await this.captureScreenshot(nodeId, resolution);

    const tab = this.#getTabForNode(nodeId);
    if (!tab) return;
    await this.#tabPort.suspendTab(tab);
    this.#probe?.tabSuspended(nodeId);
  }

  /**
   * Restore a suspended tab, subject to preload budget (max 1 concurrent).
   *
   * @param {string} nodeId
   */
  async #restoreTab(nodeId) {
    const tab = this.#getTabForNode(nodeId);
    if (!tab) return;

    if (this.#preloading >= 1) return;

    this.#preloading++;
    this.#probe?.preloadStarted(nodeId);
    try {
      await this.#tabPort.restoreTab(tab);
      this.#probe?.tabRestored(nodeId);
    } finally {
      this.#preloading--;
      this.#probe?.preloadFinished(nodeId);
    }
  }

  /**
   * Get a stored screenshot for a node at a specific resolution.
   *
   * @param {string} nodeId
   * @param {'low' | 'high'} resolution
   * @returns {{ width: number, height: number } | null}
   */
  getScreenshot(nodeId, resolution) {
    return this.#screenshots.get(`${nodeId}:${resolution}`) ?? null;
  }
}
