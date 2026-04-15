// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class SearchService {
  #tree;
  #storage;
  #probe;

  constructor(
    tree,
    storage,
    probe,
  ) {
    this.#tree = tree;
    this.#storage = storage;
    this.#probe = probe ?? null;
  }

  async search(query) {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const results = [];
    const seenIds = new Set();

    // Search in-memory tree nodes
    for (const node of this.#tree.nodes.values()) {
      if (node.id === this.#tree.rootId) continue;
      if (
        node.title.toLowerCase().includes(lowerQuery) ||
        node.url.toLowerCase().includes(lowerQuery)
      ) {
        const branchRootId = this.#tree.getBranchRootId(node.id);
        const branchRoot = branchRootId
          ? this.#tree.nodes.get(branchRootId)
          : null;
        results.push({
          nodeId: node.id,
          title: node.title,
          url: node.url,
          branchName: branchRoot?.title || '',
          branchRootId: branchRootId || '',
          timestamp: node.lastVisitedAt,
          favicon: node.favicon,
        });
        seenIds.add(node.id);
      }
    }

    // Search stored nodes (inactive branches)
    if (this.#storage) {
      const storedNodes = await this.#storage.searchNodes(query);
      for (const stored of storedNodes) {
        if (seenIds.has(stored.id)) continue;
        const branchRoot = this.#tree.nodes.get(stored.branchRootId);
        results.push({
          nodeId: stored.id,
          title: stored.title,
          url: stored.url,
          branchName: branchRoot?.title || '',
          branchRootId: stored.branchRootId,
          timestamp: stored.lastVisitedAt,
          favicon: stored.favicon,
        });
      }
    }

    results.sort((a, b) => b.timestamp - a.timestamp);
    this.#probe?.searchExecuted(query, results.length);
    return results;
  }
}
