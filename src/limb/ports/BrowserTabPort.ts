// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export interface BrowserTab {
  // Opaque reference to a Firefox tab element.
  // In production this is a XUL <tab> element.
}

export interface BrowserTabPort {
  addTab(url: string): BrowserTab;
  removeTab(tab: BrowserTab): void;
  setTabAttribute(tab: BrowserTab, name: string, value: string): void;
  getTabAttribute(tab: BrowserTab, name: string): string | null;
}
