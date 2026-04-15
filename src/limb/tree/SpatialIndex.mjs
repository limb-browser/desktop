// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Grid-based spatial index for fast region queries on 2D node positions.
 *
 * Divides the 2D plane into uniform cells and maps each node to its cell.
 * Region queries iterate only the relevant cells instead of scanning all nodes.
 *
 * Used by LODComputer to efficiently find nodes near the viewport boundary
 * (performance.md S2.1).
 */
export class SpatialIndex {
  /** @type {number} */
  #cellSize;
  /** @type {Map<string, Array<{ nodeId: string, x: number, y: number }>>} */
  #grid;

  /**
   * @param {number} [cellSize=1.0] Grid cell size in logical units
   */
  constructor(cellSize = 1.0) {
    this.#cellSize = cellSize;
    this.#grid = new Map();
  }

  /**
   * Rebuild the index from a layout map.
   * @param {Map<string, { x: number, y: number }>} layout - nodeId to position
   */
  rebuild(layout) {
    this.#grid = new Map();
    for (const [nodeId, pos] of layout) {
      const key = `${Math.floor(pos.x / this.#cellSize)},${Math.floor(pos.y / this.#cellSize)}`;
      let cell = this.#grid.get(key);
      if (!cell) {
        cell = [];
        this.#grid.set(key, cell);
      }
      cell.push({ nodeId, x: pos.x, y: pos.y });
    }
  }

  /**
   * Query nodes within a rectangular region (inclusive bounds).
   * @param {number} minX
   * @param {number} minY
   * @param {number} maxX
   * @param {number} maxY
   * @returns {string[]} Node IDs within the region
   */
  queryRegion(minX, minY, maxX, maxY) {
    const result = [];
    const minCellX = Math.floor(minX / this.#cellSize);
    const maxCellX = Math.floor(maxX / this.#cellSize);
    const minCellY = Math.floor(minY / this.#cellSize);
    const maxCellY = Math.floor(maxY / this.#cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const cell = this.#grid.get(`${cx},${cy}`);
        if (!cell) continue;
        for (const entry of cell) {
          if (entry.x >= minX && entry.x <= maxX && entry.y >= minY && entry.y <= maxY) {
            result.push(entry.nodeId);
          }
        }
      }
    }
    return result;
  }
}
