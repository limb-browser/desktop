// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * @typedef {{ nodeId: string, x: number, y: number, width: number, height: number }} NodeRect
 * @typedef {{ parentId: string, childId: string, startX: number, startY: number, endX: number, endY: number }} EdgePath
 * @typedef {{ nodes: NodeRect[], edges: EdgePath[], focusRing: NodeRect | null }} RenderFrame
 */

/**
 * Pure computation of tree render commands.
 *
 * Takes node positions (from TreeLayout), parent-child relationships,
 * and a coordinate transform, then returns NodeRects and EdgePaths
 * for visible nodes only.
 */
export class TreeRenderer {
  /** @type {number} */
  baseNodeWidth;
  /** @type {number} */
  baseNodeHeight;

  /**
   * @param {number} baseNodeWidth
   * @param {number} baseNodeHeight
   */
  constructor(baseNodeWidth, baseNodeHeight) {
    this.baseNodeWidth = baseNodeWidth;
    this.baseNodeHeight = baseNodeHeight;
  }

  /**
   * Compute a render frame: visible node rectangles and edge paths.
   *
   * @param {Map<string, { x: number, y: number }>} positions - Logical node positions from TreeLayout
   * @param {Map<string, string>} parentMap - childId -> parentId mapping
   * @param {(lx: number, ly: number) => { x: number, y: number }} toScreen - Coordinate transform
   * @param {number} zoomScale - Pixels per logical unit
   * @param {number} viewportWidth - Screen width in pixels
   * @param {number} viewportHeight - Screen height in pixels
   * @param {string} [focusedNodeId] - ID of the currently focused node (for focus ring)
   * @returns {RenderFrame}
   */
  computeFrame(positions, parentMap, toScreen, zoomScale, viewportWidth, viewportHeight, focusedNodeId) {
    const screenWidth = this.baseNodeWidth * zoomScale;
    const screenHeight = this.baseNodeHeight * zoomScale;
    const halfW = screenWidth / 2;
    const halfH = screenHeight / 2;

    // Compute screen positions and filter to visible nodes
    const screenPositions = new Map();
    const visibleSet = new Set();
    const nodes = [];

    for (const [nodeId, pos] of positions) {
      const screen = toScreen(pos.x, pos.y);
      screenPositions.set(nodeId, screen);

      const rectLeft = screen.x - halfW;
      const rectTop = screen.y - halfH;
      const rectRight = screen.x + halfW;
      const rectBottom = screen.y + halfH;

      if (
        rectRight < 0 ||
        rectLeft > viewportWidth ||
        rectBottom < 0 ||
        rectTop > viewportHeight
      ) {
        continue;
      }

      visibleSet.add(nodeId);
      nodes.push({
        nodeId,
        x: rectLeft,
        y: rectTop,
        width: screenWidth,
        height: screenHeight,
      });
    }

    // Compute edges for parent-child pairs where at least one node is visible
    const edges = [];
    for (const [childId, parentId] of parentMap) {
      const parentScreen = screenPositions.get(parentId);
      const childScreen = screenPositions.get(childId);
      if (!parentScreen || !childScreen) continue;

      if (!visibleSet.has(parentId) && !visibleSet.has(childId)) continue;

      edges.push({
        parentId,
        childId,
        startX: parentScreen.x,
        startY: parentScreen.y + halfH,
        endX: childScreen.x,
        endY: childScreen.y - halfH,
      });
    }

    let focusRing = null;
    if (focusedNodeId) {
      const focusNode = nodes.find((n) => n.nodeId === focusedNodeId);
      if (focusNode) {
        focusRing = { ...focusNode };
      }
    }

    return { nodes, edges, focusRing };
  }
}
