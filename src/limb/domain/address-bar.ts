import { TreeNode } from '../ports/tree-types';
import { isInternalUrl } from './internal-url';

const FADE_IN_START = 0.85;
const FADE_IN_END = 0.95;
const HOME_FADE_OUT_START = 0.75;
const HOME_FADE_OUT_END = 0.85;
const IN_PLACE_THRESHOLD_MS = 5000;

export function computeAddressBarOpacity(zoomLevel: number): number {
  if (zoomLevel <= FADE_IN_START) {
    return 0.0;
  }
  if (zoomLevel >= FADE_IN_END) {
    return 1.0;
  }
  return (zoomLevel - FADE_IN_START) / (FADE_IN_END - FADE_IN_START);
}

export function computeHomeButtonOpacity(zoomLevel: number): number {
  if (zoomLevel <= HOME_FADE_OUT_START) {
    return 1.0;
  }
  if (zoomLevel >= HOME_FADE_OUT_END) {
    return 0.0;
  }
  return 1.0 - (zoomLevel - HOME_FADE_OUT_START) / (HOME_FADE_OUT_END - HOME_FADE_OUT_START);
}

export function resolveUrlEntry(
  focusedNode: TreeNode,
  nowMs: number,
  enteredUrl: string,
): 'in-place' | 'branch' {
  // Internal pages are utility pages, not browsing destinations — always in-place.
  if (isInternalUrl(enteredUrl)) {
    return 'in-place';
  }

  // A blank page is just a placeholder — always navigate in-place to avoid
  // leaving a ghost parent node in the tree.
  if (focusedNode.url === 'about:blank') {
    return 'in-place';
  }

  const hasNoChildren = focusedNode.childIds.length === 0;
  const visitedRecently = (nowMs - focusedNode.lastVisitedAt) < IN_PLACE_THRESHOLD_MS;

  if (hasNoChildren && visitedRecently) {
    return 'in-place';
  }
  return 'branch';
}
