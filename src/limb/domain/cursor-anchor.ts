import type { ZoomState } from './zoom';
import { clampZoomLevel, EFFECTIVE_MIN_TREE_WIDTH } from './zoom';

/**
 * The base used for exponential zoom. Exported so tests can build
 * matching screenToWorld helpers.
 */
export const ZOOM_BASE = EFFECTIVE_MIN_TREE_WIDTH;

/**
 * Computes the zoom scale for a given level, using the same model as
 * computeNodeScreenWidth. This must stay in sync or cursor anchoring
 * will diverge from rendering.
 */
function scaleForLevel(level: number): number {
  return Math.pow(ZOOM_BASE, level) / ZOOM_BASE;
}

/**
 * Computes a new ZoomState after applying a zoom delta while keeping the
 * point under the cursor fixed on screen.
 */
export function computeAnchoredZoom(
  cursorPos: { x: number; y: number },
  currentZoom: number,
  zoomDelta: number,
  viewportSize: { width: number; height: number },
  currentFocusPoint: { x: number; y: number }
): ZoomState {
  const newLevel = clampZoomLevel(currentZoom + zoomDelta);

  const oldScale = scaleForLevel(currentZoom) * viewportSize.width;
  const newScale = scaleForLevel(newLevel) * viewportSize.width;

  const offsetX = cursorPos.x - viewportSize.width / 2;
  const offsetY = cursorPos.y - viewportSize.height / 2;

  const focusPoint = {
    x: currentFocusPoint.x + offsetX * (1 / oldScale - 1 / newScale),
    y: currentFocusPoint.y + offsetY * (1 / oldScale - 1 / newScale),
  };

  return {
    level: newLevel,
    focusPoint,
    viewportSize,
  };
}
