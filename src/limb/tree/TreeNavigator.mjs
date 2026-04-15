// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export class TreeNavigator {
  #tree;

  constructor(tree) {
    this.#tree = tree;
  }

  get focusedNodeId() {
    return this.#tree.focusedNodeId;
  }

  focusParent() {
    const node = this.#tree.nodes.get(this.#tree.focusedNodeId);
    if (!node || node.parentId === null) return null;
    this.#tree.focusNode(node.parentId);
    return node.parentId;
  }

  focusFirstChild() {
    const node = this.#tree.nodes.get(this.#tree.focusedNodeId);
    if (!node || node.childIds.length === 0) return null;
    const firstChildId = node.childIds[0];
    this.#tree.focusNode(firstChildId);
    return firstChildId;
  }

  focusPreviousSibling() {
    const node = this.#tree.nodes.get(this.#tree.focusedNodeId);
    if (!node || node.parentId === null) return null;
    const parent = this.#tree.nodes.get(node.parentId);
    if (!parent) return null;
    const index = parent.childIds.indexOf(this.#tree.focusedNodeId);
    if (index <= 0) return null;
    const prevId = parent.childIds[index - 1];
    this.#tree.focusNode(prevId);
    return prevId;
  }

  focusNextSibling() {
    const node = this.#tree.nodes.get(this.#tree.focusedNodeId);
    if (!node || node.parentId === null) return null;
    const parent = this.#tree.nodes.get(node.parentId);
    if (!parent) return null;
    const index = parent.childIds.indexOf(this.#tree.focusedNodeId);
    if (index < 0 || index >= parent.childIds.length - 1) return null;
    const nextId = parent.childIds[index + 1];
    this.#tree.focusNode(nextId);
    return nextId;
  }
}
