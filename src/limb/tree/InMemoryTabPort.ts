// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { TabPort } from '../ports/TabPort';

export interface FakeTab {
  url: string;
  nodeId: string;
  closed: boolean;
}

export class InMemoryTabPort implements TabPort<FakeTab> {
  tabs: FakeTab[] = [];

  async openTab(url: string, nodeId: string): Promise<FakeTab> {
    const tab: FakeTab = { url, nodeId, closed: false };
    this.tabs.push(tab);
    return tab;
  }

  async closeTab(tab: FakeTab): Promise<void> {
    if (tab.closed) {
      return;
    }
    tab.closed = true;
  }

  get openTabs(): FakeTab[] {
    return this.tabs.filter((t) => !t.closed);
  }
}
