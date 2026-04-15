// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { computeFoldNodeFrame } from './FoldNodeRenderer.mjs';

describe('FoldNodeRenderer', () => {
  describe('computeFoldNodeFrame', () => {
    const baseRect = { x: 100, y: 50, width: 80, height: 60 };

    it('returns background cards and a front card', () => {
      const frame = computeFoldNodeFrame(baseRect);

      expect(frame.backgroundCards.length).toBeGreaterThanOrEqual(2);
      expect(frame.frontCard).toBeDefined();
    });

    it('background cards are offset from the front card', () => {
      const frame = computeFoldNodeFrame(baseRect);

      for (const bg of frame.backgroundCards) {
        // Background cards should be offset (shifted right and up)
        expect(bg.x).not.toBe(frame.frontCard.x);
        expect(bg.y).not.toBe(frame.frontCard.y);
      }
    });

    it('front card matches the input rect position and size', () => {
      const frame = computeFoldNodeFrame(baseRect);

      expect(frame.frontCard.x).toBe(baseRect.x);
      expect(frame.frontCard.y).toBe(baseRect.y);
      expect(frame.frontCard.width).toBe(baseRect.width);
      expect(frame.frontCard.height).toBe(baseRect.height);
    });

    it('background cards have the same size as the front card', () => {
      const frame = computeFoldNodeFrame(baseRect);

      for (const bg of frame.backgroundCards) {
        expect(bg.width).toBe(baseRect.width);
        expect(bg.height).toBe(baseRect.height);
      }
    });

    it('background cards are ordered back to front (largest offset first)', () => {
      const frame = computeFoldNodeFrame(baseRect);

      for (let i = 1; i < frame.backgroundCards.length; i++) {
        const prev = frame.backgroundCards[i - 1];
        const curr = frame.backgroundCards[i];
        // Earlier cards have larger offset from front
        expect(prev.x).toBeGreaterThan(curr.x);
      }
    });
  });

  describe('formatFoldLabel', () => {
    it('formats label with month and count', async () => {
      const { formatFoldLabel } = await import('./FoldNodeRenderer.mjs');
      expect(formatFoldLabel('Mar 2026', 23)).toBe('Mar 2026 (23 branches)');
    });

    it('uses singular for 1 branch', async () => {
      const { formatFoldLabel } = await import('./FoldNodeRenderer.mjs');
      expect(formatFoldLabel('Jan 2025', 1)).toBe('Jan 2025 (1 branch)');
    });
  });
});
