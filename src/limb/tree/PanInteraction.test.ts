// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { PanInteraction } from './PanInteraction.mjs';
import { ZoomState } from './ZoomState.mjs';

const viewport = { width: 1000, height: 800 };
const treeExtent = { width: 10, height: 5 };

function createPannable(level: number) {
  const zoom = new ZoomState(viewport, treeExtent);
  zoom.setLevel(level);
  zoom.focusPoint = { x: 5, y: 3 };
  const pan = new PanInteraction(zoom);
  return { zoom, pan };
}

describe('PanInteraction', () => {
  describe('dragging moves the viewport by the correct amount in logical space', () => {
    it('updates focusPoint based on screen delta divided by zoomScale', () => {
      const { zoom, pan } = createPannable(0.5);
      const scale = zoom.zoomScale;
      const startFocus = { ...zoom.focusPoint };

      pan.onMouseDown(400, 300);
      // Move enough to exceed threshold (5px)
      pan.onMouseMove(410, 300);
      // Then move further
      pan.onMouseMove(500, 400);

      // Total delta from 410,300 to 500,400 = 90,100
      // Plus the initial threshold-crossing move from 400,300 to 410,300 = 10,0
      // But the initial move sets lastScreen to the threshold point, so
      // delta from threshold to last is 500-410=90 for x, 400-300=100 for y
      // plus the threshold move itself: 10,0
      // focusPoint should decrease by total screen delta / scale
      const totalDeltaX = 500 - 400;
      const totalDeltaY = 400 - 300;
      expect(zoom.focusPoint.x).toBeCloseTo(startFocus.x - totalDeltaX / scale);
      expect(zoom.focusPoint.y).toBeCloseTo(startFocus.y - totalDeltaY / scale);
    });

    it('accumulates multiple mousemove deltas correctly', () => {
      const { zoom, pan } = createPannable(0.3);
      const scale = zoom.zoomScale;
      const startFocus = { ...zoom.focusPoint };

      pan.onMouseDown(200, 200);
      pan.onMouseMove(210, 200); // exceed threshold
      pan.onMouseMove(250, 250); // further
      pan.onMouseMove(300, 350); // further still

      const totalDeltaX = 300 - 200;
      const totalDeltaY = 350 - 200;
      expect(zoom.focusPoint.x).toBeCloseTo(startFocus.x - totalDeltaX / scale);
      expect(zoom.focusPoint.y).toBeCloseTo(startFocus.y - totalDeltaY / scale);
    });
  });

  describe('pan only works when zoom < 0.9', () => {
    it('does not start panning when zoomLevel >= 0.9', () => {
      const { zoom, pan } = createPannable(0.9);
      const startFocus = { ...zoom.focusPoint };

      pan.onMouseDown(400, 300);
      pan.onMouseMove(500, 400);
      pan.onMouseUp();

      expect(zoom.focusPoint.x).toBe(startFocus.x);
      expect(zoom.focusPoint.y).toBe(startFocus.y);
    });

    it('does not start panning at zoomLevel = 1.0', () => {
      const { zoom, pan } = createPannable(1.0);
      const startFocus = { ...zoom.focusPoint };

      pan.onMouseDown(400, 300);
      pan.onMouseMove(500, 400);
      pan.onMouseUp();

      expect(zoom.focusPoint.x).toBe(startFocus.x);
      expect(zoom.focusPoint.y).toBe(startFocus.y);
    });

    it('allows panning at zoomLevel = 0.89', () => {
      const { zoom, pan } = createPannable(0.89);
      const startFocus = { ...zoom.focusPoint };

      pan.onMouseDown(400, 300);
      pan.onMouseMove(500, 400);

      expect(zoom.focusPoint.x).not.toBe(startFocus.x);
    });

    it('allows panning at zoomLevel = 0.0', () => {
      const { zoom, pan } = createPannable(0.0);
      const startFocus = { ...zoom.focusPoint };

      pan.onMouseDown(400, 300);
      pan.onMouseMove(500, 400);

      expect(zoom.focusPoint.x).not.toBe(startFocus.x);
    });
  });

  describe('short clicks are not treated as pans', () => {
    it('does not pan when movement is less than 5px', () => {
      const { zoom, pan } = createPannable(0.5);
      const startFocus = { ...zoom.focusPoint };

      pan.onMouseDown(400, 300);
      pan.onMouseMove(403, 302); // distance = sqrt(9+4) ≈ 3.6px < 5
      pan.onMouseUp();

      expect(zoom.focusPoint.x).toBe(startFocus.x);
      expect(zoom.focusPoint.y).toBe(startFocus.y);
    });

    it('does not pan when movement is exactly at 5px threshold', () => {
      const { zoom, pan } = createPannable(0.5);
      const startFocus = { ...zoom.focusPoint };

      pan.onMouseDown(400, 300);
      // distance = sqrt(9+16) = sqrt(25) = 5.0 exactly — not exceeded
      pan.onMouseMove(403, 304);
      pan.onMouseUp();

      expect(zoom.focusPoint.x).toBe(startFocus.x);
      expect(zoom.focusPoint.y).toBe(startFocus.y);
    });

    it('onMouseUp returns true when it was a click (no drag)', () => {
      const { pan } = createPannable(0.5);

      pan.onMouseDown(400, 300);
      pan.onMouseMove(401, 300);
      const wasClick = pan.onMouseUp();

      expect(wasClick).toBe(true);
    });

    it('onMouseUp returns false when it was a drag', () => {
      const { pan } = createPannable(0.5);

      pan.onMouseDown(400, 300);
      pan.onMouseMove(420, 320);
      const wasClick = pan.onMouseUp();

      expect(wasClick).toBe(false);
    });
  });

  describe('cursor', () => {
    it('returns "grab" when in pan mode and not dragging', () => {
      const { pan } = createPannable(0.5);
      expect(pan.cursor).toBe('grab');
    });

    it('returns "grabbing" while dragging', () => {
      const { pan } = createPannable(0.5);

      pan.onMouseDown(400, 300);
      pan.onMouseMove(420, 320); // exceed threshold
      expect(pan.cursor).toBe('grabbing');
    });

    it('returns "default" when zoom >= 0.9', () => {
      const { pan } = createPannable(0.9);
      expect(pan.cursor).toBe('default');
    });

    it('returns "grab" after drag ends', () => {
      const { pan } = createPannable(0.5);

      pan.onMouseDown(400, 300);
      pan.onMouseMove(420, 320);
      pan.onMouseUp();

      expect(pan.cursor).toBe('grab');
    });
  });

  describe('onMouseMove returns repaint signal', () => {
    it('returns false when not mouse-down', () => {
      const { pan } = createPannable(0.5);
      expect(pan.onMouseMove(400, 300)).toBe(false);
    });

    it('returns false when within threshold', () => {
      const { pan } = createPannable(0.5);
      pan.onMouseDown(400, 300);
      expect(pan.onMouseMove(402, 301)).toBe(false);
    });

    it('returns true once threshold exceeded', () => {
      const { pan } = createPannable(0.5);
      pan.onMouseDown(400, 300);
      expect(pan.onMouseMove(420, 320)).toBe(true);
    });

    it('returns true on subsequent moves after threshold', () => {
      const { pan } = createPannable(0.5);
      pan.onMouseDown(400, 300);
      pan.onMouseMove(420, 320);
      expect(pan.onMouseMove(430, 330)).toBe(true);
    });
  });
});
