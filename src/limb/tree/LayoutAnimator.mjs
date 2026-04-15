// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * @typedef {{ x: number, y: number }} Position
 * @typedef {{ positions: Map<string, Position>, parentMap: Map<string, string>, opacity: Map<string, number>, edgeProgress: Map<string, number>, edgeOpacity: Map<string, number>, isAnimating: boolean }} AnimatedFrame
 */

// Timing constants from interaction-feel.md S4
const SHIFT_DURATION = 200;       // ms, position animation (ease-in-out)
const FADE_IN_DURATION = 150;     // ms, new node opacity (ease-out)
const FADE_IN_DELAY = 100;        // ms, delay after shift begins
const FADE_OUT_DURATION = 150;    // ms, removed node opacity (linear per S7.1)
const EDGE_DRAW_DURATION = 200;   // ms, new edge draw-in (ease-out)
const REMOVAL_SHIFT_DELAY = 150;  // ms, shift waits for fade-out to complete
const MAX_TOTAL_TIME = 400;       // ms cap per S4.3

/**
 * Quadratic ease-in-out: slow start, fast middle, slow end.
 * Used for position shifts (S7.1: non-opacity uses easing).
 *
 * @param {number} t - Progress 0 to 1
 * @returns {number}
 */
function easeInOut(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < 0.5) return 2 * t * t;
  return 1 - (-2 * t + 2) * (-2 * t + 2) / 2;
}

/**
 * Quadratic ease-out: fast start, slow end.
 * Used for fade-in and edge draw-in (S4.1).
 *
 * @param {number} t - Progress 0 to 1
 * @returns {number}
 */
function easeOut(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - (1 - t) * (1 - t);
}

/**
 * Animates tree layout transitions: position interpolation, opacity fades,
 * and edge draw-in/fade-out.
 *
 * Tracks previous layout positions and detects node additions, removals,
 * and moves. When layout changes, interpolates smoothly using timing
 * from interaction-feel.md S4.
 *
 * Node Addition (S4.1):
 *   - Existing nodes shift to new positions (200ms, ease-in-out)
 *   - New node fades in from opacity 0 (150ms, ease-out, 100ms delay)
 *   - New edge draws in progressively (200ms, ease-out)
 *
 * Node Removal (S4.2):
 *   - Removed node fades out (150ms, linear)
 *   - Edge fades simultaneously (150ms, linear)
 *   - Remaining nodes shift to fill gap (200ms, ease-in-out, after fade)
 *
 * Batch Changes (S4.3):
 *   - All animations play concurrently, total <= 400ms
 */
export class LayoutAnimator {
  /** @type {Map<string, Position>} */
  #previousPositions = new Map();
  /** @type {Map<string, string>} */
  #previousParentMap = new Map();
  /** @type {number} */
  #elapsed = 0;
  /** @type {boolean} */
  #active = false;
  /** @type {number} */
  #shiftDelay = 0;

  // Per-transition animation data
  /** @type {Map<string, { fromX: number, fromY: number, toX: number, toY: number }>} */
  #movedNodes = new Map();
  /** @type {Set<string>} */
  #addedNodes = new Set();
  /** @type {Map<string, Position>} */
  #removedNodes = new Map();
  /** @type {Set<string>} */
  #addedEdges = new Set();
  /** @type {Map<string, string>} childId -> parentId for removed edges */
  #removedEdgeParents = new Map();
  /** @type {Map<string, Position>} */
  #targetPositions = new Map();
  /** @type {Map<string, string>} */
  #targetParentMap = new Map();

  /** @type {import('../ports/LayoutAnimationProbe').LayoutAnimationProbe | null} */
  #probe = null;

  /**
   * @param {import('../ports/LayoutAnimationProbe').LayoutAnimationProbe} [probe]
   */
  constructor(probe) {
    this.#probe = probe ?? null;
  }

  /** @returns {boolean} */
  get isAnimating() {
    return this.#active;
  }

  /**
   * Begin a layout transition. Compares new positions against the previous
   * layout to detect additions, removals, and moves, then starts animations.
   *
   * If called during an active animation, the previous animation snaps to
   * its target and the new transition begins from there.
   *
   * @param {Map<string, Position>} newPositions
   * @param {Map<string, string>} parentMap - childId -> parentId
   */
  beginTransition(newPositions, parentMap) {
    if (this.#active) {
      this.#previousPositions = new Map(this.#targetPositions);
      this.#previousParentMap = new Map(this.#targetParentMap);
      this.#active = false;
      this.#probe?.transitionCancelled();
    }

    const oldPositions = this.#previousPositions;
    const oldParentMap = this.#previousParentMap;

    // First layout: snap without animation
    if (oldPositions.size === 0) {
      this.#previousPositions = new Map(newPositions);
      this.#previousParentMap = new Map(parentMap);
      return;
    }

    // Detect changes
    const movedNodes = new Map();
    const addedNodes = new Set();
    const removedNodes = new Map();
    const addedEdges = new Set();
    const removedEdgeParents = new Map();

    for (const [nodeId, newPos] of newPositions) {
      const oldPos = oldPositions.get(nodeId);
      if (!oldPos) {
        addedNodes.add(nodeId);
      } else if (oldPos.x !== newPos.x || oldPos.y !== newPos.y) {
        movedNodes.set(nodeId, {
          fromX: oldPos.x, fromY: oldPos.y,
          toX: newPos.x, toY: newPos.y,
        });
      }
    }

    for (const [nodeId, oldPos] of oldPositions) {
      if (!newPositions.has(nodeId)) {
        removedNodes.set(nodeId, { x: oldPos.x, y: oldPos.y });
      }
    }

    for (const [childId] of parentMap) {
      if (!oldParentMap.has(childId)) {
        addedEdges.add(childId);
      }
    }

    for (const [childId, parentId] of oldParentMap) {
      if (!parentMap.has(childId)) {
        removedEdgeParents.set(childId, parentId);
      }
    }

    // No changes: just update stored positions
    if (movedNodes.size === 0 && addedNodes.size === 0 && removedNodes.size === 0) {
      this.#previousPositions = new Map(newPositions);
      this.#previousParentMap = new Map(parentMap);
      return;
    }

    this.#movedNodes = movedNodes;
    this.#addedNodes = addedNodes;
    this.#removedNodes = removedNodes;
    this.#addedEdges = addedEdges;
    this.#removedEdgeParents = removedEdgeParents;
    this.#targetPositions = new Map(newPositions);
    this.#targetParentMap = new Map(parentMap);
    this.#elapsed = 0;
    this.#active = true;

    // When removals exist, delay shifts until fade-out completes (S4.2)
    this.#shiftDelay = removedNodes.size > 0 ? REMOVAL_SHIFT_DELAY : 0;

    this.#probe?.transitionStarted(addedNodes.size, removedNodes.size, movedNodes.size);
  }

  /**
   * Advance animations by deltaMs and return the current animated frame.
   *
   * When not animating, returns the settled (previous) positions with
   * empty opacity/edge maps and isAnimating=false.
   *
   * @param {number} deltaMs
   * @returns {AnimatedFrame}
   */
  tick(deltaMs) {
    if (!this.#active) {
      return {
        positions: new Map(this.#previousPositions),
        parentMap: new Map(this.#previousParentMap),
        opacity: new Map(),
        edgeProgress: new Map(),
        edgeOpacity: new Map(),
        isAnimating: false,
      };
    }

    this.#elapsed += deltaMs;

    const positions = new Map(this.#targetPositions);
    const parentMap = new Map(this.#targetParentMap);
    const opacity = new Map();
    const edgeProgress = new Map();
    const edgeOpacity = new Map();

    // Position shifts (ease-in-out, starts after shiftDelay)
    for (const [nodeId, move] of this.#movedNodes) {
      const shiftElapsed = Math.max(0, this.#elapsed - this.#shiftDelay);
      const t = Math.min(1, shiftElapsed / SHIFT_DURATION);
      const eased = easeInOut(t);
      positions.set(nodeId, {
        x: move.fromX + (move.toX - move.fromX) * eased,
        y: move.fromY + (move.toY - move.fromY) * eased,
      });
    }

    // Fade-in for added nodes (ease-out, starts after shiftDelay + FADE_IN_DELAY)
    const fadeInStart = this.#shiftDelay + FADE_IN_DELAY;
    for (const nodeId of this.#addedNodes) {
      const fadeElapsed = Math.max(0, this.#elapsed - fadeInStart);
      const t = Math.min(1, fadeElapsed / FADE_IN_DURATION);
      opacity.set(nodeId, easeOut(t));
    }

    // Fade-out for removed nodes (linear, starts at t=0)
    for (const [nodeId, nodePos] of this.#removedNodes) {
      const t = Math.min(1, this.#elapsed / FADE_OUT_DURATION);
      const nodeOpacity = 1 - t;
      if (nodeOpacity > 0) {
        positions.set(nodeId, { x: nodePos.x, y: nodePos.y });
        opacity.set(nodeId, nodeOpacity);
      }
    }

    // Edge draw-in for new edges (ease-out, starts after shiftDelay)
    for (const childId of this.#addedEdges) {
      const edgeElapsed = Math.max(0, this.#elapsed - this.#shiftDelay);
      const t = Math.min(1, edgeElapsed / EDGE_DRAW_DURATION);
      edgeProgress.set(childId, easeOut(t));
    }

    // Edge fade-out for removed edges (linear, starts at t=0)
    for (const [childId, parentId] of this.#removedEdgeParents) {
      const t = Math.min(1, this.#elapsed / FADE_OUT_DURATION);
      const edgeOp = 1 - t;
      if (edgeOp > 0) {
        edgeOpacity.set(childId, edgeOp);
        parentMap.set(childId, parentId);
      }
    }

    // Check if all animations are complete
    const totalTime = this.#computeTotalTime();
    if (this.#elapsed >= totalTime) {
      this.#finishTransition();
    }

    return {
      positions,
      parentMap,
      opacity,
      edgeProgress,
      edgeOpacity,
      isAnimating: this.#active,
    };
  }

  /** @returns {number} */
  #computeTotalTime() {
    let maxTime = 0;

    if (this.#movedNodes.size > 0) {
      maxTime = Math.max(maxTime, this.#shiftDelay + SHIFT_DURATION);
    }
    if (this.#addedNodes.size > 0) {
      maxTime = Math.max(maxTime, this.#shiftDelay + FADE_IN_DELAY + FADE_IN_DURATION);
    }
    if (this.#removedNodes.size > 0) {
      maxTime = Math.max(maxTime, FADE_OUT_DURATION);
    }
    if (this.#addedEdges.size > 0) {
      maxTime = Math.max(maxTime, this.#shiftDelay + EDGE_DRAW_DURATION);
    }
    if (this.#removedEdgeParents.size > 0) {
      maxTime = Math.max(maxTime, FADE_OUT_DURATION);
    }

    return Math.min(maxTime, MAX_TOTAL_TIME);
  }

  #finishTransition() {
    this.#previousPositions = new Map(this.#targetPositions);
    this.#previousParentMap = new Map(this.#targetParentMap);
    this.#active = false;
    this.#movedNodes.clear();
    this.#addedNodes.clear();
    this.#removedNodes.clear();
    this.#addedEdges.clear();
    this.#removedEdgeParents.clear();
    this.#probe?.transitionCompleted();
  }
}
