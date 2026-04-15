// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Builds a 7-node test tree with pre-computed layout positions
 * for verifying the rendering pipeline end-to-end.
 *
 * Tree structure:
 *           root
 *          /    \
 *        a       b
 *       / \       \
 *     a1   a2      b1
 *     |
 *    a1x
 *
 * Layout positions (computed as TreeLayout would):
 *   leaves: a1x=0, a2=1, b1=2 (consecutive integers)
 *   a1 centered over a1x: x=0
 *   a centered over a1..a2: x=0.5
 *   b centered over b1: x=2
 *   root centered over a..b: x=1.25
 *
 * @returns {{ positions: Map<string, { x: number, y: number }>, parentMap: Map<string, string>, treeExtent: { width: number, height: number } }}
 */
export function buildTestTreeData() {
  const positions = new Map([
    ["root", { x: 1.25, y: 0 }],
    ["a",    { x: 0.5,  y: 1 }],
    ["b",    { x: 2,    y: 1 }],
    ["a1",   { x: 0,    y: 2 }],
    ["a2",   { x: 1,    y: 2 }],
    ["b1",   { x: 2,    y: 2 }],
    ["a1x",  { x: 0,    y: 3 }],
  ]);

  const parentMap = new Map([
    ["a",   "root"],
    ["b",   "root"],
    ["a1",  "a"],
    ["a2",  "a"],
    ["b1",  "b"],
    ["a1x", "a1"],
  ]);

  // Extent: x ranges 0..2, y ranges 0..3. Add padding of 1 unit on each side.
  const treeExtent = { width: 4, height: 5 };

  return { positions, parentMap, treeExtent };
}
