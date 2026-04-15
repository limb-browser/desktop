// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { BrowsingTree } from './BrowsingTree';
import type { TabBridge } from './TabBridge';
import type { UrlEntryRouterProbe } from '../ports/UrlEntryRouterProbe';

const RECENCY_THRESHOLD_MS = 5000;

export class UrlEntryRouter<TTab> {
  #tree: BrowsingTree;
  #bridge: TabBridge<TTab>;
  #probe: UrlEntryRouterProbe | null;

  constructor(
    tree: BrowsingTree,
    bridge: TabBridge<TTab>,
    probe?: UrlEntryRouterProbe
  ) {
    this.#tree = tree;
    this.#bridge = bridge;
    this.#probe = probe ?? null;
  }

  async handleUrlEntry(url: string): Promise<'in-place' | 'create-child'> {
    if (url.startsWith('about:limb-')) {
      this.#probe?.navigatedInPlace(this.#tree.focusedNodeId, url);
      return 'in-place';
    }

    const node = this.#tree.nodes.get(this.#tree.focusedNodeId)!;
    const elapsed = Date.now() - node.lastVisitedAt;

    if (node.childIds.length === 0 && elapsed < RECENCY_THRESHOLD_MS) {
      this.#probe?.navigatedInPlace(this.#tree.focusedNodeId, url);
      return 'in-place';
    }

    const parentId = this.#tree.focusedNodeId;
    const child = this.#tree.addChild(parentId, url);
    await this.#bridge.createTabForNode({
      id: child.id,
      url: child.url,
      parentId: child.parentId,
      createdAt: child.createdAt,
    });
    this.#tree.focusNode(child.id);
    await this.#bridge.syncFocusToTab(
      child.id,
      child.url,
      child.parentId,
      child.createdAt
    );
    this.#probe?.childCreated(parentId, child.id, url);
    return 'create-child';
  }
}
