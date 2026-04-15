// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class BranchCommandRouter {
  #tree;
  #bridge;
  #autoSave;
  #confirmPort;
  #homeUrl;
  #probe;

  constructor(
    tree,
    bridge,
    autoSave,
    confirmPort,
    homeUrl,
    probe,
  ) {
    this.#tree = tree;
    this.#bridge = bridge;
    this.#autoSave = autoSave;
    this.#confirmPort = confirmPort;
    this.#homeUrl = homeUrl;
    this.#probe = probe ?? null;
  }

  async createBranch() {
    this.#autoSave.saveNow();

    const child = this.#tree.addChild(this.#tree.rootId, this.#homeUrl);
    this.#tree.focusNode(child.id);
    await this.#bridge.syncFocusToTab(
      child.id,
      child.url,
      child.parentId,
      child.createdAt,
    );
    this.#probe?.branchCreated(child.id);
    return child.id;
  }

  async deleteBranch(branchRootId) {
    const node = this.#tree.nodes.get(branchRootId);
    if (!node) {
      throw new Error(`Node "${branchRootId}" does not exist`);
    }
    if (branchRootId === this.#tree.rootId) {
      throw new Error('Cannot delete the root node');
    }

    const descendants = this.#tree
      .getDescendants(branchRootId)
      .filter((n) => n.id !== branchRootId);
    const nodeCount = 1 + descendants.length;

    if (nodeCount > 1) {
      const confirmed = await this.#confirmPort.confirm(
        `Delete branch with ${nodeCount} pages?`,
      );
      if (!confirmed) {
        this.#probe?.branchDeletionCancelled(branchRootId);
        return;
      }
    }

    const descendantIds = descendants.map((n) => n.id);
    this.#tree.removeNode(branchRootId);
    await this.#bridge.onNodeRemoved(branchRootId, descendantIds);
    this.#probe?.branchDeleted(branchRootId);
  }
}
