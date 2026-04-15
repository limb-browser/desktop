// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { AddressBarVisibility } from './AddressBarVisibility.mjs';
import type { AddressBarVisibilityProbe } from '../ports/AddressBarVisibilityProbe';

function createProbe(): AddressBarVisibilityProbe & {
  calls: { opacity: number; interactive: boolean }[];
} {
  const calls: { opacity: number; interactive: boolean }[] = [];
  return {
    calls,
    visibilityChanged(opacity, interactive) {
      calls.push({ opacity, interactive });
    },
  };
}

describe('AddressBarVisibility', () => {
  describe('opacity computation', () => {
    it('returns 1.0 at zoom level 1.0', () => {
      const v = new AddressBarVisibility();
      v.zoomChanged(1.0, 0);
      expect(v.opacity).toBe(1.0);
    });

    it('returns 0.0 at zoom level 0.5', () => {
      const v = new AddressBarVisibility();
      v.zoomChanged(0.5, 0);
      expect(v.opacity).toBe(0.0);
    });

    it('returns 0.5 at zoom level 0.9', () => {
      const v = new AddressBarVisibility();
      v.zoomChanged(0.9, 0);
      expect(v.opacity).toBeCloseTo(0.5);
    });

    it('returns 0.0 at zoom level 0.0', () => {
      const v = new AddressBarVisibility();
      v.zoomChanged(0.0, 0);
      expect(v.opacity).toBe(0.0);
    });

    it('returns 0.0 at exactly zoom level 0.85', () => {
      const v = new AddressBarVisibility();
      v.zoomChanged(0.85, 0);
      expect(v.opacity).toBe(0.0);
    });

    it('returns 1.0 at exactly zoom level 0.95', () => {
      const v = new AddressBarVisibility();
      v.zoomChanged(0.95, 0);
      expect(v.opacity).toBe(1.0);
    });

    it('returns 1.0 above 0.95', () => {
      const v = new AddressBarVisibility();
      v.zoomChanged(0.98, 0);
      expect(v.opacity).toBe(1.0);
    });

    it('linearly interpolates between 0.85 and 0.95', () => {
      const v = new AddressBarVisibility();
      v.zoomChanged(0.87, 0);
      expect(v.opacity).toBeCloseTo(0.2);

      v.zoomChanged(0.92, 0);
      expect(v.opacity).toBeCloseTo(0.7);
    });
  });

  describe('interactivity', () => {
    it('is not interactive when opacity is 0.0', () => {
      const v = new AddressBarVisibility();
      v.zoomChanged(0.5, 0);
      expect(v.interactive).toBe(false);
    });

    it('is interactive when opacity is greater than 0.0', () => {
      const v = new AddressBarVisibility();
      v.zoomChanged(0.9, 0);
      expect(v.interactive).toBe(true);
    });

    it('is interactive at full opacity', () => {
      const v = new AddressBarVisibility();
      v.zoomChanged(1.0, 0);
      expect(v.interactive).toBe(true);
    });

    it('is not interactive at exactly 0.85 (opacity 0.0)', () => {
      const v = new AddressBarVisibility();
      v.zoomChanged(0.85, 0);
      expect(v.interactive).toBe(false);
    });
  });

  describe('auto-zoom decision', () => {
    it('should auto-zoom when zoom level is below 0.85', () => {
      const v = new AddressBarVisibility();
      expect(v.shouldAutoZoom(0.5)).toBe(true);
    });

    it('should auto-zoom when zoom level is 0.0', () => {
      const v = new AddressBarVisibility();
      expect(v.shouldAutoZoom(0.0)).toBe(true);
    });

    it('should not auto-zoom when zoom level is exactly 0.85', () => {
      const v = new AddressBarVisibility();
      expect(v.shouldAutoZoom(0.85)).toBe(false);
    });

    it('should not auto-zoom when zoom level is above 0.85', () => {
      const v = new AddressBarVisibility();
      expect(v.shouldAutoZoom(0.9)).toBe(false);
    });

    it('should not auto-zoom when zoom level is 1.0', () => {
      const v = new AddressBarVisibility();
      expect(v.shouldAutoZoom(1.0)).toBe(false);
    });

    it('auto-zoom target is 0.95', () => {
      const v = new AddressBarVisibility();
      expect(v.autoZoomTarget).toBe(0.95);
    });
  });

  describe('probe', () => {
    it('fires visibilityChanged when opacity changes', () => {
      const probe = createProbe();
      const v = new AddressBarVisibility(probe);

      v.zoomChanged(0.9, 0);

      expect(probe.calls).toHaveLength(1);
      expect(probe.calls[0].opacity).toBeCloseTo(0.5);
      expect(probe.calls[0].interactive).toBe(true);
    });

    it('fires visibilityChanged when transitioning to hidden', () => {
      const probe = createProbe();
      const v = new AddressBarVisibility(probe);

      v.zoomChanged(1.0, 0);
      probe.calls.length = 0;

      v.zoomChanged(0.5, 0);

      expect(probe.calls).toHaveLength(1);
      expect(probe.calls[0].opacity).toBe(0.0);
      expect(probe.calls[0].interactive).toBe(false);
    });

    it('does not fire when opacity and interactivity are unchanged', () => {
      const probe = createProbe();
      const v = new AddressBarVisibility(probe);

      v.zoomChanged(1.0, 0);
      probe.calls.length = 0;

      v.zoomChanged(0.98, 0);

      expect(probe.calls).toHaveLength(0);
    });

    it('fires when opacity changes within fade range', () => {
      const probe = createProbe();
      const v = new AddressBarVisibility(probe);

      v.zoomChanged(0.87, 0);
      probe.calls.length = 0;

      v.zoomChanged(0.92, 0);

      expect(probe.calls).toHaveLength(1);
      expect(probe.calls[0].opacity).toBeCloseTo(0.7);
      expect(probe.calls[0].interactive).toBe(true);
    });

    it('works without a probe', () => {
      const v = new AddressBarVisibility();
      expect(() => v.zoomChanged(0.9, 0)).not.toThrow();
    });
  });

  describe('initial state', () => {
    it('starts with opacity 1.0 and interactive true', () => {
      const v = new AddressBarVisibility();
      expect(v.opacity).toBe(1.0);
      expect(v.interactive).toBe(true);
    });
  });
});
