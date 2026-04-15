// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { KeyboardNavigationAdapter } from './KeyboardNavigationAdapter.mjs';
import { TreeNavigator } from './TreeNavigator';
import { BrowsingTree } from './BrowsingTree';

function createFakeWindow(): {
  addEventListener(type: string, fn: EventListener, capture?: boolean): void;
  removeEventListener(type: string, fn: EventListener, capture?: boolean): void;
  _listeners: { type: string; fn: EventListener; capture?: boolean }[];
} {
  const listeners: { type: string; fn: EventListener; capture?: boolean }[] = [];
  return {
    addEventListener(type: string, fn: EventListener, capture?: boolean) {
      listeners.push({ type, fn, capture });
    },
    removeEventListener(type: string, fn: EventListener, capture?: boolean) {
      const idx = listeners.findIndex(
        (l) => l.type === type && l.fn === fn && l.capture === capture,
      );
      if (idx >= 0) listeners.splice(idx, 1);
    },
    _listeners: listeners,
  };
}

function createFakeTreeView(initialLevel = 0.5) {
  let level = initialLevel;
  const centerCalls: string[] = [];
  return {
    get zoomLevel() {
      return level;
    },
    setZoomLevel(newLevel: number) {
      level = newLevel;
    },
    centerOnNode(nodeId: string) {
      centerCalls.push(nodeId);
    },
    centerCalls,
  };
}

function createFakeUrlBar(focused = false) {
  let isFocused = focused;
  let blurCalled = false;
  return {
    get focused() {
      return isFocused;
    },
    set focused(v: boolean) {
      isFocused = v;
    },
    blur() {
      blurCalled = true;
      isFocused = false;
    },
    get blurCalled() {
      return blurCalled;
    },
  };
}

function dispatchKeydown(
  win: ReturnType<typeof createFakeWindow>,
  key: string,
  modifiers: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean } = {},
) {
  let defaultPrevented = false;
  let propagationStopped = false;
  const event = {
    key,
    ctrlKey: modifiers.ctrlKey ?? false,
    altKey: modifiers.altKey ?? false,
    shiftKey: modifiers.shiftKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    preventDefault() {
      defaultPrevented = true;
    },
    stopPropagation() {
      propagationStopped = true;
    },
  };
  for (const listener of win._listeners) {
    if (listener.type === 'keydown') {
      listener.fn(event as unknown as Event);
    }
  }
  return { defaultPrevented, propagationStopped };
}

describe('KeyboardNavigationAdapter', () => {
  let tree: BrowsingTree;
  let nav: TreeNavigator;
  let treeView: ReturnType<typeof createFakeTreeView>;
  let urlBar: ReturnType<typeof createFakeUrlBar>;
  let win: ReturnType<typeof createFakeWindow>;
  let adapter: InstanceType<typeof KeyboardNavigationAdapter>;

  beforeEach(() => {
    tree = new BrowsingTree('https://root.com');
    nav = new TreeNavigator(tree);
    treeView = createFakeTreeView();
    urlBar = createFakeUrlBar();
    win = createFakeWindow();
    adapter = new KeyboardNavigationAdapter(nav, treeView, urlBar);
    adapter.install(win as unknown as Window);
  });

  describe('Alt+Up - focus parent', () => {
    it('focuses the parent node', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);

      dispatchKeydown(win, 'ArrowUp', { altKey: true });

      expect(tree.focusedNodeId).toBe(tree.rootId);
    });

    it('is a no-op on root', () => {
      dispatchKeydown(win, 'ArrowUp', { altKey: true });

      expect(tree.focusedNodeId).toBe(tree.rootId);
    });

    it('prevents default and stops propagation', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);

      const { defaultPrevented, propagationStopped } = dispatchKeydown(win, 'ArrowUp', { altKey: true });

      expect(defaultPrevented).toBe(true);
      expect(propagationStopped).toBe(true);
    });
  });

  describe('Alt+Down - focus first child', () => {
    it('focuses the first child node', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');

      dispatchKeydown(win, 'ArrowDown', { altKey: true });

      expect(tree.focusedNodeId).toBe(child.id);
    });

    it('is a no-op on leaf', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);

      dispatchKeydown(win, 'ArrowDown', { altKey: true });

      expect(tree.focusedNodeId).toBe(child.id);
    });
  });

  describe('Alt+Left - focus previous sibling', () => {
    it('focuses the previous sibling', () => {
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      tree.focusNode(c2.id);

      dispatchKeydown(win, 'ArrowLeft', { altKey: true });

      expect(tree.focusedNodeId).toBe(c1.id);
    });

    it('is a no-op on first sibling', () => {
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      tree.addChild(tree.rootId, 'https://b.com');
      tree.focusNode(c1.id);

      dispatchKeydown(win, 'ArrowLeft', { altKey: true });

      expect(tree.focusedNodeId).toBe(c1.id);
    });
  });

  describe('Alt+Right - focus next sibling', () => {
    it('focuses the next sibling', () => {
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      tree.focusNode(c1.id);

      dispatchKeydown(win, 'ArrowRight', { altKey: true });

      expect(tree.focusedNodeId).toBe(c2.id);
    });

    it('is a no-op on last sibling', () => {
      tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');
      tree.focusNode(c2.id);

      dispatchKeydown(win, 'ArrowRight', { altKey: true });

      expect(tree.focusedNodeId).toBe(c2.id);
    });
  });

  describe('post-navigation viewport centering', () => {
    it('centers viewport on new node when zoom level >= 0.9', () => {
      treeView.setZoomLevel(0.95);
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);

      dispatchKeydown(win, 'ArrowUp', { altKey: true });

      expect(treeView.centerCalls).toContain(tree.rootId);
    });

    it('does not center viewport when zoom level < 0.9', () => {
      treeView.setZoomLevel(0.5);
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);

      dispatchKeydown(win, 'ArrowUp', { altKey: true });

      expect(treeView.centerCalls).toHaveLength(0);
    });

    it('centers at exactly 0.9', () => {
      treeView.setZoomLevel(0.9);
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);

      dispatchKeydown(win, 'ArrowUp', { altKey: true });

      expect(treeView.centerCalls).toContain(tree.rootId);
    });

    it('does not center when navigation is a no-op', () => {
      treeView.setZoomLevel(0.95);

      dispatchKeydown(win, 'ArrowUp', { altKey: true }); // root, no parent

      expect(treeView.centerCalls).toHaveLength(0);
    });
  });

  describe('Ctrl+0 - reset zoom to fit tree', () => {
    it('sets zoom level to 0', () => {
      treeView.setZoomLevel(0.8);

      dispatchKeydown(win, '0', { ctrlKey: true });

      expect(treeView.zoomLevel).toBe(0);
    });

    it('prevents default and stops propagation', () => {
      const { defaultPrevented, propagationStopped } = dispatchKeydown(win, '0', { ctrlKey: true });

      expect(defaultPrevented).toBe(true);
      expect(propagationStopped).toBe(true);
    });
  });

  describe('Ctrl+1 - zoom to 100% on focused node', () => {
    it('sets zoom level to 1.0', () => {
      treeView.setZoomLevel(0.5);

      dispatchKeydown(win, '1', { ctrlKey: true });

      expect(treeView.zoomLevel).toBe(1);
    });

    it('centers on focused node', () => {
      dispatchKeydown(win, '1', { ctrlKey: true });

      expect(treeView.centerCalls).toContain(tree.focusedNodeId);
    });

    it('prevents default and stops propagation', () => {
      const { defaultPrevented, propagationStopped } = dispatchKeydown(win, '1', { ctrlKey: true });

      expect(defaultPrevented).toBe(true);
      expect(propagationStopped).toBe(true);
    });
  });

  describe('Escape', () => {
    it('blurs the address bar when it is focused', () => {
      urlBar.focused = true;

      dispatchKeydown(win, 'Escape', {});

      expect(urlBar.blurCalled).toBe(true);
    });

    it('zooms to focused node when zoomed out (level < 0.9)', () => {
      treeView.setZoomLevel(0.5);

      dispatchKeydown(win, 'Escape', {});

      expect(treeView.zoomLevel).toBe(1);
      expect(treeView.centerCalls).toContain(tree.focusedNodeId);
    });

    it('address bar blur takes priority over zoom', () => {
      urlBar.focused = true;
      treeView.setZoomLevel(0.5);

      dispatchKeydown(win, 'Escape', {});

      expect(urlBar.blurCalled).toBe(true);
      // Zoom should not change when handling address bar
      expect(treeView.zoomLevel).toBe(0.5);
    });

    it('is a no-op when zoomed in and address bar not focused', () => {
      treeView.setZoomLevel(0.95);
      urlBar.focused = false;

      dispatchKeydown(win, 'Escape', {});

      expect(treeView.zoomLevel).toBe(0.95);
      expect(urlBar.blurCalled).toBe(false);
    });
  });

  describe('modifier isolation', () => {
    it('ignores Alt+arrows when Ctrl is also held', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);

      dispatchKeydown(win, 'ArrowUp', { altKey: true, ctrlKey: true });

      expect(tree.focusedNodeId).toBe(child.id);
    });

    it('ignores Ctrl+0 when Alt is also held', () => {
      treeView.setZoomLevel(0.8);

      dispatchKeydown(win, '0', { ctrlKey: true, altKey: true });

      expect(treeView.zoomLevel).toBe(0.8);
    });

    it('ignores plain arrow keys without Alt', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);

      dispatchKeydown(win, 'ArrowUp', {});

      expect(tree.focusedNodeId).toBe(child.id);
    });
  });

  describe('install / uninstall', () => {
    it('registers a keydown listener on install', () => {
      const newWin = createFakeWindow();
      const a = new KeyboardNavigationAdapter(nav, treeView, urlBar);
      a.install(newWin as unknown as Window);

      expect(newWin._listeners).toHaveLength(1);
      expect(newWin._listeners[0].type).toBe('keydown');
      expect(newWin._listeners[0].capture).toBe(true);
    });

    it('removes the keydown listener on uninstall', () => {
      expect(win._listeners).toHaveLength(1);

      adapter.uninstall();

      expect(win._listeners).toHaveLength(0);
    });
  });
});
