// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * @typedef {{ x: number, y: number, width: number, height: number }} CardRect
 * @typedef {{ backgroundCards: CardRect[], frontCard: CardRect }} FoldNodeFrame
 */

const STACK_OFFSET = 3;
const STACK_COUNT = 2;

/**
 * Compute the drawing primitives for a fold node's stacked-cards appearance.
 *
 * Returns background card rects (drawn back-to-front) and the front card rect.
 * The front card matches the input rect exactly. Background cards are offset
 * to the right and upward to create a stacked-cards illusion.
 *
 * @param {{ x: number, y: number, width: number, height: number }} rect
 * @returns {FoldNodeFrame}
 */
export function computeFoldNodeFrame(rect) {
  const backgroundCards = [];
  for (let i = STACK_COUNT; i > 0; i--) {
    backgroundCards.push({
      x: rect.x + i * STACK_OFFSET,
      y: rect.y - i * STACK_OFFSET,
      width: rect.width,
      height: rect.height,
    });
  }

  return {
    backgroundCards,
    frontCard: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
  };
}

/**
 * Format the label for a fold node.
 *
 * @param {string} monthLabel - e.g., "Mar 2026"
 * @param {number} branchCount
 * @returns {string} - e.g., "Mar 2026 (23 branches)"
 */
export function formatFoldLabel(monthLabel, branchCount) {
  const noun = branchCount === 1 ? 'branch' : 'branches';
  return `${monthLabel} (${branchCount} ${noun})`;
}
