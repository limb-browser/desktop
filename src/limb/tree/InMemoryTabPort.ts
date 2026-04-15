// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { TabPort } from '../ports/TabPort';

export interface FakeTab {
  url: string;
  nodeId: string;
  parentId: string | null;
  createdAt: number | null;
  closed: boolean;
  suspended: boolean;
}

export class InMemoryTabPort implements TabPort<FakeTab> {
  tabs: FakeTab[] = [];
  selectedTab: FakeTab | null = null;

  /**
   * Optional synchronous callback fired when a tab is created, before
   * openTab resolves. Simulates Firefox's synchronous TabOpen event
   * that fires during gBrowser.addTab(). Tests should set this to
   * exercise code paths that react to TabOpen during tab creation
   * (e.g., orphan detection racing with tabToNode mapping).
   */
  onTabCreated: ((tab: FakeTab) => void) | null = null;

  async openTab(url: string, nodeId: string): Promise<FakeTab> {
    const tab: FakeTab = { url, nodeId, parentId: null, createdAt: null, closed: false, suspended: false };
    this.tabs.push(tab);
    this.onTabCreated?.(tab);
    return tab;
  }

  async closeTab(tab: FakeTab): Promise<void> {
    if (tab.closed) {
      return;
    }
    tab.closed = true;
  }

  async selectTab(tab: FakeTab): Promise<void> {
    this.selectedTab = tab;
  }

  async suspendTab(tab: FakeTab): Promise<void> {
    tab.suspended = true;
  }

  async restoreTab(tab: FakeTab): Promise<void> {
    tab.suspended = false;
  }

  async isTabSuspended(tab: FakeTab): Promise<boolean> {
    return tab.suspended;
  }

  setTreeAttributes(tab: FakeTab, parentId: string | null, createdAt: number): void {
    // DOM setAttribute(name, null) serializes null to the string "null",
    // which corrupts root-node identification on restore.  Model correct
    // behaviour: only set parentId when it carries a real value.
    if (parentId !== null) {
      tab.parentId = parentId;
    }
    tab.createdAt = createdAt;
  }

  get openTabs(): FakeTab[] {
    return this.tabs.filter((t) => !t.closed);
  }
}
