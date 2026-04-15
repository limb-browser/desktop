// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Browser chrome adapter that wires ScreenshotEvictor to the browser
 * lifecycle: runs eviction on startup and hourly.
 *
 * Returns the evictor so the caller can call uninstall() on shutdown.
 *
 * See spec persistence.md S4.2, performance.md S5.1.
 */

import { ScreenshotEvictor } from "./ScreenshotEvictor.ts";

/**
 * Create and start a ScreenshotEvictor that runs on startup and hourly.
 *
 * @param {object} storage - storage implementation
 * @param {object} tree - BrowsingTree instance
 * @param {object} prefs - preferences implementation
 * @param {object} [probe] - optional eviction probe
 * @returns {ScreenshotEvictor}
 */
export function startScreenshotEviction(storage, tree, prefs, probe) {
  const evictor = new ScreenshotEvictor(storage, tree, prefs, probe);
  evictor.install();
  return evictor;
}
