import { describe, it, expect } from 'vitest';
import { computeAnchoredZoom, ZOOM_BASE } from './cursor-anchor';

// Helper: compute world position from screen position
function screenToWorld(
  screenX: number, screenY: number,
  focusX: number, focusY: number,
  level: number, vp: { width: number; height: number }
) {
  const scale = Math.pow(ZOOM_BASE, level) / ZOOM_BASE * vp.width;
  return {
    x: (screenX - vp.width / 2) / scale + focusX,
    y: (screenY - vp.height / 2) / scale + focusY,
  };
}

describe('computeAnchoredZoom', () => {
  const viewportSize = { width: 1280, height: 720 };

  it('returns new zoom level = currentZoom + zoomDelta', () => {
    const result = computeAnchoredZoom(
      { x: 640, y: 360 },
      0.5,
      0.1,
      viewportSize,
      { x: 0, y: 0 }
    );
    expect(result.level).toBeCloseTo(0.6, 10);
  });

  it('clamps zoom level to 0.0 minimum', () => {
    const result = computeAnchoredZoom(
      { x: 640, y: 360 },
      0.1,
      -0.5,
      viewportSize,
      { x: 0, y: 0 }
    );
    expect(result.level).toBe(0.0);
  });

  it('clamps zoom level to 1.0 maximum', () => {
    const result = computeAnchoredZoom(
      { x: 640, y: 360 },
      0.9,
      0.5,
      viewportSize,
      { x: 0, y: 0 }
    );
    expect(result.level).toBe(1.0);
  });

  it('preserves viewport size in returned state', () => {
    const result = computeAnchoredZoom(
      { x: 640, y: 360 },
      0.5,
      0.1,
      viewportSize,
      { x: 0, y: 0 }
    );
    expect(result.viewportSize).toEqual(viewportSize);
  });

  it('cursor at viewport center does not shift focus point from origin', () => {
    const result = computeAnchoredZoom(
      { x: 640, y: 360 }, // viewport center
      0.5,
      0.1,
      viewportSize,
      { x: 0, y: 0 }
    );
    // When cursor is at center and focus is origin, focus point should not change
    expect(result.focusPoint.x).toBeCloseTo(0, 10);
    expect(result.focusPoint.y).toBeCloseTo(0, 10);
  });

  it('cursor at viewport center preserves non-zero focus point', () => {
    const currentFocus = { x: 42, y: -17 };
    const result = computeAnchoredZoom(
      { x: 640, y: 360 }, // viewport center
      0.5,
      0.1,
      viewportSize,
      currentFocus
    );
    // When cursor is at center, focus point should not change regardless of initial value
    expect(result.focusPoint.x).toBeCloseTo(currentFocus.x, 10);
    expect(result.focusPoint.y).toBeCloseTo(currentFocus.y, 10);
  });

  it('cursor off-center shifts focus point toward cursor', () => {
    // Cursor in top-left quadrant
    const result = computeAnchoredZoom(
      { x: 320, y: 180 }, // left of center, above center
      0.3,
      0.1,
      viewportSize,
      { x: 0, y: 0 }
    );
    // Zooming in with cursor left-of-center should shift focus left (negative x)
    expect(result.focusPoint.x).toBeLessThan(0);
    // And up (negative y)
    expect(result.focusPoint.y).toBeLessThan(0);
  });

  it('cursor off-center in opposite direction shifts focus opposite', () => {
    // Cursor in bottom-right quadrant
    const result = computeAnchoredZoom(
      { x: 960, y: 540 }, // right of center, below center
      0.3,
      0.1,
      viewportSize,
      { x: 0, y: 0 }
    );
    expect(result.focusPoint.x).toBeGreaterThan(0);
    expect(result.focusPoint.y).toBeGreaterThan(0);
  });

  it('world point under cursor stays fixed after zoom (zero-origin)', () => {
    const cursorPos = { x: 400, y: 200 };
    const currentLevel = 0.4;
    const zoomDelta = 0.15;
    const currentFocusPoint = { x: 0, y: 0 };

    // World point under cursor BEFORE zoom
    const worldBefore = screenToWorld(
      cursorPos.x, cursorPos.y,
      currentFocusPoint.x, currentFocusPoint.y,
      currentLevel, viewportSize
    );

    const result = computeAnchoredZoom(cursorPos, currentLevel, zoomDelta, viewportSize, currentFocusPoint);

    // World point under cursor AFTER zoom
    const worldAfter = screenToWorld(
      cursorPos.x, cursorPos.y,
      result.focusPoint.x, result.focusPoint.y,
      result.level, viewportSize
    );

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 10);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 10);
  });

  it('world point under cursor stays fixed with non-zero starting focus', () => {
    const cursorPos = { x: 400, y: 200 };
    const currentLevel = 0.4;
    const zoomDelta = 0.15;
    const currentFocusPoint = { x: 55.3, y: -22.7 };

    // World point under cursor BEFORE zoom
    const worldBefore = screenToWorld(
      cursorPos.x, cursorPos.y,
      currentFocusPoint.x, currentFocusPoint.y,
      currentLevel, viewportSize
    );

    const result = computeAnchoredZoom(cursorPos, currentLevel, zoomDelta, viewportSize, currentFocusPoint);

    // World point under cursor AFTER zoom
    const worldAfter = screenToWorld(
      cursorPos.x, cursorPos.y,
      result.focusPoint.x, result.focusPoint.y,
      result.level, viewportSize
    );

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 10);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 10);
  });

  it('zooming out also keeps cursor point fixed', () => {
    const cursorPos = { x: 800, y: 500 };
    const currentLevel = 0.7;
    const zoomDelta = -0.2;
    const currentFocusPoint = { x: 0, y: 0 };

    const worldBefore = screenToWorld(
      cursorPos.x, cursorPos.y,
      currentFocusPoint.x, currentFocusPoint.y,
      currentLevel, viewportSize
    );

    const result = computeAnchoredZoom(cursorPos, currentLevel, zoomDelta, viewportSize, currentFocusPoint);

    const worldAfter = screenToWorld(
      cursorPos.x, cursorPos.y,
      result.focusPoint.x, result.focusPoint.y,
      result.level, viewportSize
    );

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 10);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 10);
  });

  it('zooming out with non-zero focus keeps cursor point fixed', () => {
    const cursorPos = { x: 800, y: 500 };
    const currentLevel = 0.7;
    const zoomDelta = -0.2;
    const currentFocusPoint = { x: -30, y: 100.5 };

    const worldBefore = screenToWorld(
      cursorPos.x, cursorPos.y,
      currentFocusPoint.x, currentFocusPoint.y,
      currentLevel, viewportSize
    );

    const result = computeAnchoredZoom(cursorPos, currentLevel, zoomDelta, viewportSize, currentFocusPoint);

    const worldAfter = screenToWorld(
      cursorPos.x, cursorPos.y,
      result.focusPoint.x, result.focusPoint.y,
      result.level, viewportSize
    );

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 10);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 10);
  });

  it('zero delta returns unchanged state', () => {
    const currentFocusPoint = { x: 12, y: -8 };
    const result = computeAnchoredZoom(
      { x: 400, y: 200 },
      0.5,
      0,
      viewportSize,
      currentFocusPoint
    );
    expect(result.level).toBe(0.5);
    expect(result.focusPoint.x).toBeCloseTo(currentFocusPoint.x, 10);
    expect(result.focusPoint.y).toBeCloseTo(currentFocusPoint.y, 10);
  });
});
