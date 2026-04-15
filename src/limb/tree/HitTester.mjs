// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * @typedef {{ nodeId: string, x: number, y: number, width: number, height: number }} NodeRect
 */

/**
 * Hit-test a screen position against node rectangles.
 *
 * Returns the nodeId of the first rect containing the point, or null.
 *
 * @param {number} screenX
 * @param {number} screenY
 * @param {NodeRect[]} nodeRects
 * @returns {string | null}
 */
export function hitTestNodes(screenX, screenY, nodeRects) {
  for (const rect of nodeRects) {
    if (
      screenX >= rect.x &&
      screenX <= rect.x + rect.width &&
      screenY >= rect.y &&
      screenY <= rect.y + rect.height
    ) {
      return rect.nodeId;
    }
  }
  return null;
}
