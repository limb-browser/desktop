// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsController } from './SettingsController';
import { InMemoryPrefsPort } from './InMemoryPrefsPort';

describe('SettingsController', () => {
  let prefs: InMemoryPrefsPort;
  let controller: SettingsController;

  beforeEach(() => {
    prefs = new InMemoryPrefsPort();
    controller = new SettingsController(prefs);
  });

  describe('reading current values', () => {
    it('returns default homepage when no pref is set', () => {
      expect(controller.homepage).toBe('about:blank');
    });

    it('returns stored homepage when pref is set', () => {
      prefs.setStringPref('limb.home.url', 'https://example.com');
      controller = new SettingsController(prefs);

      expect(controller.homepage).toBe('https://example.com');
    });

    it('returns default max live tabs when no pref is set', () => {
      expect(controller.maxLiveTabs).toBe(8);
    });

    it('returns stored max live tabs when pref is set', () => {
      prefs.setIntPref('limb.tree.max-live-tabs', 4);
      controller = new SettingsController(prefs);

      expect(controller.maxLiveTabs).toBe(4);
    });
  });

  describe('updating homepage', () => {
    it('writes homepage to prefs', () => {
      controller.homepage = 'https://new-home.com';

      expect(prefs.getStringPref('limb.home.url', '')).toBe('https://new-home.com');
    });

    it('reflects the new value immediately', () => {
      controller.homepage = 'https://changed.com';

      expect(controller.homepage).toBe('https://changed.com');
    });
  });

  describe('updating max live tabs', () => {
    it('writes max live tabs to prefs', () => {
      controller.maxLiveTabs = 6;

      expect(prefs.getIntPref('limb.tree.max-live-tabs', 0)).toBe(6);
    });

    it('reflects the new value immediately', () => {
      controller.maxLiveTabs = 10;

      expect(controller.maxLiveTabs).toBe(10);
    });

    it('clamps value to minimum of 1', () => {
      controller.maxLiveTabs = 0;

      expect(controller.maxLiveTabs).toBe(1);
      expect(prefs.getIntPref('limb.tree.max-live-tabs', 0)).toBe(1);
    });

    it('clamps value to maximum of 12', () => {
      controller.maxLiveTabs = 20;

      expect(controller.maxLiveTabs).toBe(12);
      expect(prefs.getIntPref('limb.tree.max-live-tabs', 0)).toBe(12);
    });

    it('accepts boundary value 1', () => {
      controller.maxLiveTabs = 1;

      expect(controller.maxLiveTabs).toBe(1);
    });

    it('accepts boundary value 12', () => {
      controller.maxLiveTabs = 12;

      expect(controller.maxLiveTabs).toBe(12);
    });

    it('rounds non-integer values down', () => {
      controller.maxLiveTabs = 5.7;

      expect(controller.maxLiveTabs).toBe(5);
    });
  });
});
