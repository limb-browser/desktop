// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * @typedef {{ nodeId: string, x: number, y: number, width: number, height: number }} NodeRect
 * @typedef {{ nodeId: string, text: string, x: number, y: number, fontSize: number, opacity: number }} Label
 */

const LABEL_MIN_WIDTH = 60;
const DEFAULT_OPACITY = 0.7;
const LABEL_PADDING = 4;
const FONT_SCALE = 0.15;
const MIN_FONT_SIZE = 9;
const MAX_FONT_SIZE = 16;

/**
 * Pure computation of node label data.
 *
 * Labels appear below node frames when nodes are large enough to read
 * (tree-rendering.md S2.3). Font size scales with zoom (via node width).
 * Text is truncated with ellipsis when it would overflow.
 */
export class NodeLabelComputer {
  /**
   * Compute label data for visible nodes.
   *
   * @param {NodeRect[]} nodeRects - Visible nodes from TreeRenderer
   * @param {Map<string, string>} titles - nodeId -> title
   * @param {(text: string, fontSize: number) => number} measureText - Returns pixel width of text at given font size
   * @returns {Label[]}
   */
  computeLabels(nodeRects, titles, measureText) {
    const labels = [];

    for (const rect of nodeRects) {
      if (rect.width <= LABEL_MIN_WIDTH) continue;

      const title = titles.get(rect.nodeId);
      if (!title) continue;

      const fontSize = Math.max(
        MIN_FONT_SIZE,
        Math.min(MAX_FONT_SIZE, rect.width * FONT_SCALE),
      );
      const maxWidth = rect.width;
      const text = truncateWithEllipsis(title, maxWidth, fontSize, measureText);

      labels.push({
        nodeId: rect.nodeId,
        text,
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height + LABEL_PADDING + fontSize,
        fontSize,
        opacity: DEFAULT_OPACITY,
      });
    }

    return labels;
  }
}

/**
 * Truncate text with ellipsis if it exceeds maxWidth.
 *
 * @param {string} text
 * @param {number} maxWidth
 * @param {number} fontSize
 * @param {(text: string, fontSize: number) => number} measureText
 * @returns {string}
 */
function truncateWithEllipsis(text, maxWidth, fontSize, measureText) {
  if (measureText(text, fontSize) <= maxWidth) return text;

  const ellipsis = '\u2026';
  let lo = 0;
  let hi = text.length;

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid) + ellipsis;
    if (measureText(candidate, fontSize) <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  if (lo === 0) return ellipsis;
  return text.slice(0, lo) + ellipsis;
}
