// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { PrefsPort } from '../ports/PrefsPort';

const PREF_HOMEPAGE = 'limb.home.url';
const PREF_MAX_LIVE_TABS = 'limb.tree.max-live-tabs';

const DEFAULT_HOMEPAGE = 'about:blank';
const DEFAULT_MAX_LIVE_TABS = 8;
const MIN_LIVE_TABS = 1;
const MAX_LIVE_TABS = 12;

export class SettingsController {
  #prefs: PrefsPort;

  constructor(prefs: PrefsPort) {
    this.#prefs = prefs;
  }

  get homepage(): string {
    return this.#prefs.getStringPref(PREF_HOMEPAGE, DEFAULT_HOMEPAGE);
  }

  set homepage(value: string) {
    this.#prefs.setStringPref(PREF_HOMEPAGE, value);
  }

  get maxLiveTabs(): number {
    return this.#prefs.getIntPref(PREF_MAX_LIVE_TABS, DEFAULT_MAX_LIVE_TABS);
  }

  set maxLiveTabs(value: number) {
    const clamped = Math.max(MIN_LIVE_TABS, Math.min(MAX_LIVE_TABS, Math.floor(value)));
    this.#prefs.setIntPref(PREF_MAX_LIVE_TABS, clamped);
  }
}
