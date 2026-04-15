// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryTabPort } from './InMemoryTabPort';

describe('InMemoryTabPort', () => {
  let port: InMemoryTabPort;

  beforeEach(() => {
    port = new InMemoryTabPort();
  });

  describe('openTab', () => {
    it('creates a tab with the given url and nodeId', async () => {
      const tab = await port.openTab('https://example.com', 'node-1');
      expect(tab.url).toBe('https://example.com');
      expect(tab.nodeId).toBe('node-1');
      expect(tab.closed).toBe(false);
    });

    it('tracks all created tabs', async () => {
      await port.openTab('https://a.com', 'n1');
      await port.openTab('https://b.com', 'n2');
      expect(port.tabs).toHaveLength(2);
    });
  });

  describe('closeTab', () => {
    it('marks the tab as closed', async () => {
      const tab = await port.openTab('https://example.com', 'node-1');
      await port.closeTab(tab);
      expect(tab.closed).toBe(true);
    });

    it('is a no-op for an already-closed tab', async () => {
      const tab = await port.openTab('https://example.com', 'node-1');
      await port.closeTab(tab);
      await port.closeTab(tab);
      expect(tab.closed).toBe(true);
    });
  });

  describe('openTabs', () => {
    it('returns only tabs that are not closed', async () => {
      const tab1 = await port.openTab('https://a.com', 'n1');
      await port.openTab('https://b.com', 'n2');
      await port.closeTab(tab1);
      expect(port.openTabs).toHaveLength(1);
      expect(port.openTabs[0].nodeId).toBe('n2');
    });
  });
});
