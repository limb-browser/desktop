// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { ZoomProbe } from '../ports/ZoomProbe';

/**
 * Pure domain model for zoom state and coordinate transforms.
 *
 * Zoom maps a tree in logical coordinates onto a screen viewport.
 * - level 0.0: entire tree fits in viewport
 * - level 1.0: focused node fills viewport width
 *
 * zoomScale is pixels per logical unit, interpolated exponentially
 * between minScale (fits tree) and maxScale (fills viewport).
 *
 * Coordinate system: focusPoint (logical) maps to viewport center (screen).
 */
export class ZoomState {
  private _level: number = 0;
  focusPoint: { x: number; y: number } = { x: 0, y: 0 };
  viewportSize: { width: number; height: number };
  treeExtent: { width: number; height: number };
  private probe: ZoomProbe | null;

  constructor(
    viewportSize: { width: number; height: number },
    treeExtent: { width: number; height: number } = { width: 1, height: 1 },
    probe?: ZoomProbe,
  ) {
    this.viewportSize = { ...viewportSize };
    this.treeExtent = { ...treeExtent };
    this.probe = probe ?? null;
  }

  get level(): number {
    return this._level;
  }

  setLevel(newLevel: number): void {
    this._level = Math.max(0, Math.min(1, newLevel));
    this.probe?.zoomChanged(this._level, this.zoomScale);
  }

  /**
   * Pixels per logical unit at the current zoom level.
   *
   * At level=1.0: one logical unit fills the viewport width (maxScale).
   * At level=0.0: the entire tree fits in the viewport (minScale).
   * Intermediate levels use exponential interpolation.
   */
  get zoomScale(): number {
    const maxScale = this.viewportSize.width;
    const minScaleX = this.viewportSize.width / Math.max(this.treeExtent.width, 1);
    const minScaleY = this.viewportSize.height / Math.max(this.treeExtent.height, 1);
    const minScale = Math.min(minScaleX, minScaleY);

    if (minScale >= maxScale) return maxScale;
    return minScale * Math.pow(maxScale / minScale, this._level);
  }

  /**
   * Convert logical (tree) coordinates to screen (pixel) coordinates.
   * The focusPoint maps to the center of the viewport.
   */
  logicalToScreen(x: number, y: number): { x: number; y: number } {
    const scale = this.zoomScale;
    return {
      x: (x - this.focusPoint.x) * scale + this.viewportSize.width / 2,
      y: (y - this.focusPoint.y) * scale + this.viewportSize.height / 2,
    };
  }

  /**
   * Convert screen (pixel) coordinates to logical (tree) coordinates.
   * Inverse of logicalToScreen.
   */
  screenToLogical(x: number, y: number): { x: number; y: number } {
    const scale = this.zoomScale;
    return {
      x: (x - this.viewportSize.width / 2) / scale + this.focusPoint.x,
      y: (y - this.viewportSize.height / 2) / scale + this.focusPoint.y,
    };
  }

  /**
   * Zoom by deltaLevel with cursor anchoring: the logical point under
   * (cursorScreenX, cursorScreenY) stays at the same screen position
   * after the zoom.
   */
  zoomAtCursor(
    deltaLevel: number,
    cursorScreenX: number,
    cursorScreenY: number,
  ): void {
    const logicalCursor = this.screenToLogical(cursorScreenX, cursorScreenY);
    this.setLevel(this._level + deltaLevel);
    const newScale = this.zoomScale;
    this.focusPoint = {
      x: logicalCursor.x - (cursorScreenX - this.viewportSize.width / 2) / newScale,
      y: logicalCursor.y - (cursorScreenY - this.viewportSize.height / 2) / newScale,
    };
  }
}
