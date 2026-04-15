// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { BrowsingTree } from './BrowsingTree';
import { TreeNavigator } from './TreeNavigator';

describe('TreeNavigator', () => {
  let tree: BrowsingTree;
  let nav: TreeNavigator;

  beforeEach(() => {
    tree = new BrowsingTree('https://root.com');
    nav = new TreeNavigator(tree);
  });

  describe('focusParent', () => {
    it('focuses the parent node', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);

      const result = nav.focusParent();

      expect(result).toBe(tree.rootId);
      expect(tree.focusedNodeId).toBe(tree.rootId);
    });

    it('returns null when focused node is root (no parent)', () => {
      const result = nav.focusParent();

      expect(result).toBeNull();
      expect(tree.focusedNodeId).toBe(tree.rootId);
    });

    it('navigates from grandchild to child', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      const grandchild = tree.addChild(child.id, 'https://grandchild.com');
      tree.focusNode(grandchild.id);

      const result = nav.focusParent();

      expect(result).toBe(child.id);
      expect(tree.focusedNodeId).toBe(child.id);
    });
  });

  describe('focusFirstChild', () => {
    it('focuses the first child node', () => {
      const child1 = tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(tree.rootId, 'https://b.com');

      const result = nav.focusFirstChild();

      expect(result).toBe(child1.id);
      expect(tree.focusedNodeId).toBe(child1.id);
    });

    it('returns null when focused node is a leaf (no children)', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);

      const result = nav.focusFirstChild();

      expect(result).toBeNull();
      expect(tree.focusedNodeId).toBe(child.id);
    });

    it('returns null when root has no children', () => {
      const result = nav.focusFirstChild();

      expect(result).toBeNull();
      expect(tree.focusedNodeId).toBe(tree.rootId);
    });

    it('always selects the first child in order', () => {
      const c1 = tree.addChild(tree.rootId, 'https://first.com');
      tree.addChild(tree.rootId, 'https://second.com');
      tree.addChild(tree.rootId, 'https://third.com');

      const result = nav.focusFirstChild();

      expect(result).toBe(c1.id);
    });
  });

  describe('focusPreviousSibling', () => {
    it('focuses the previous sibling', () => {
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      tree.focusNode(c2.id);

      const result = nav.focusPreviousSibling();

      expect(result).toBe(c1.id);
      expect(tree.focusedNodeId).toBe(c1.id);
    });

    it('returns null when focused node is the first sibling', () => {
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(tree.rootId, 'https://b.com');
      tree.focusNode(c1.id);

      const result = nav.focusPreviousSibling();

      expect(result).toBeNull();
      expect(tree.focusedNodeId).toBe(c1.id);
    });

    it('returns null when focused node is root (no parent)', () => {
      const result = nav.focusPreviousSibling();

      expect(result).toBeNull();
      expect(tree.focusedNodeId).toBe(tree.rootId);
    });

    it('navigates through multiple siblings', () => {
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      const c3 = tree.addChild(tree.rootId, 'https://c.com');
      tree.focusNode(c3.id);

      nav.focusPreviousSibling();
      expect(tree.focusedNodeId).toBe(c2.id);

      nav.focusPreviousSibling();
      expect(tree.focusedNodeId).toBe(c1.id);

      const result = nav.focusPreviousSibling();
      expect(result).toBeNull();
      expect(tree.focusedNodeId).toBe(c1.id);
    });
  });

  describe('focusNextSibling', () => {
    it('focuses the next sibling', () => {
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      tree.focusNode(c1.id);

      const result = nav.focusNextSibling();

      expect(result).toBe(c2.id);
      expect(tree.focusedNodeId).toBe(c2.id);
    });

    it('returns null when focused node is the last sibling', () => {
      tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      tree.focusNode(c2.id);

      const result = nav.focusNextSibling();

      expect(result).toBeNull();
      expect(tree.focusedNodeId).toBe(c2.id);
    });

    it('returns null when focused node is root (no parent)', () => {
      const result = nav.focusNextSibling();

      expect(result).toBeNull();
      expect(tree.focusedNodeId).toBe(tree.rootId);
    });

    it('navigates through multiple siblings', () => {
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      const c3 = tree.addChild(tree.rootId, 'https://c.com');
      tree.focusNode(c1.id);

      nav.focusNextSibling();
      expect(tree.focusedNodeId).toBe(c2.id);

      nav.focusNextSibling();
      expect(tree.focusedNodeId).toBe(c3.id);

      const result = nav.focusNextSibling();
      expect(result).toBeNull();
      expect(tree.focusedNodeId).toBe(c3.id);
    });
  });

  describe('focusedNodeId', () => {
    it('returns the tree focused node ID', () => {
      expect(nav.focusedNodeId).toBe(tree.rootId);

      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);
      expect(nav.focusedNodeId).toBe(child.id);
    });
  });
});
