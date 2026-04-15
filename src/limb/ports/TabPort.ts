// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export interface TabPort<TTab> {
  openTab(url: string, nodeId: string): Promise<TTab>;
  closeTab(tab: TTab): Promise<void>;
  selectTab(tab: TTab): Promise<void>;
  restoreTab(tab: TTab): Promise<void>;
  isTabSuspended(tab: TTab): Promise<boolean>;
}
