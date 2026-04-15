// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Browser chrome adapter for TreeRestorer.
 *
 * After SessionStore restores tabs on startup, this module reads
 * limb tree attributes from tab elements and reconstructs the
 * BrowsingTree using the domain-pure TreeRestorer.
 *
 * See spec persistence.md S1.3.
 */

import { TreeRestorer as TreeRestorerDomain } from "./TreeRestorer.ts";

/**
 * Read tree metadata from all restored tabs and rebuild the BrowsingTree.
 *
 * @param {object} tabbrowser - the window's gBrowser instance
 * @param {object} [probe] - optional TreeRestorerProbe
 * @returns {{ tree: object, tabMap: Map<string, object> }}
 *   tree: the restored BrowsingTree
 *   tabMap: Map from nodeId to the corresponding tab element
 */
export function restoreTreeFromTabs(tabbrowser, probe) {
  const tabs = Array.from(tabbrowser.tabs);
  const tabsData = [];
  const tabsByNodeId = new Map();

  for (const tab of tabs) {
    const nodeId = tab.getAttribute("limb-node-id") || null;
    const parentId = tab.getAttribute("limb-tree-parent-id") || null;
    const createdAtRaw = tab.getAttribute("limb-tree-created-at");
    const createdAt = createdAtRaw ? Number(createdAtRaw) : null;
    const url = tab.linkedBrowser?.currentURI?.spec ?? "about:blank";
    const title = tab.label ?? "";

    tabsData.push({ nodeId, parentId, createdAt, url, title, favicon: null });

    if (nodeId) {
      tabsByNodeId.set(nodeId, tab);
    }
  }

  const restorer = new TreeRestorerDomain(probe);
  const tree = restorer.restore(tabsData);

  return { tree, tabMap: tabsByNodeId };
}
