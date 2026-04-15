// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { KeyboardNavigationAdapter } from './KeyboardNavigationAdapter.mjs';
import { TreeNavigator } from './TreeNavigator';
import { BrowsingTree } from './BrowsingTree';
import { BranchCommandRouter } from './BranchCommandRouter';
import { TabBridge } from './TabBridge';
import { InMemoryTabPort } from './InMemoryTabPort';
import { InMemoryConfirmationPort } from './InMemoryConfirmationPort';
import { AutoSaveTrigger } from './AutoSaveTrigger';
import type { TimerPort } from '../ports/TimerPort';

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
  const setFocusedNodeIdCalls: string[] = [];
  const animateToNodeCalls: { nodeId: string; level: number }[] = [];
  return {
    get zoomLevel() {
      return level;
    },
    setZoomLevel(newLevel: number) {
      level = newLevel;
    },
    setFocusedNodeId(nodeId: string) {
      setFocusedNodeIdCalls.push(nodeId);
    },
    centerOnNode(nodeId: string) {
      centerCalls.push(nodeId);
    },
    animateToNode(nodeId: string, targetLevel: number) {
      animateToNodeCalls.push({ nodeId, level: targetLevel });
      level = targetLevel;
    },
    centerCalls,
    setFocusedNodeIdCalls,
    animateToNodeCalls,
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

  describe('post-navigation state sync and centering', () => {
    it('syncs focused node ID to tree view after navigation', () => {
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);

      dispatchKeydown(win, 'ArrowUp', { altKey: true });

      expect(treeView.setFocusedNodeIdCalls).toContain(tree.rootId);
    });

    it('syncs focused node ID for all navigation directions', () => {
      const c1 = tree.addChild(tree.rootId, 'https://a.com');
      const c2 = tree.addChild(tree.rootId, 'https://b.com');

      // Alt+Down: root -> c1
      dispatchKeydown(win, 'ArrowDown', { altKey: true });
      expect(treeView.setFocusedNodeIdCalls).toContain(c1.id);

      // Alt+Right: c1 -> c2
      dispatchKeydown(win, 'ArrowRight', { altKey: true });
      expect(treeView.setFocusedNodeIdCalls).toContain(c2.id);

      // Alt+Left: c2 -> c1
      dispatchKeydown(win, 'ArrowLeft', { altKey: true });
      expect(treeView.setFocusedNodeIdCalls.filter((id) => id === c1.id)).toHaveLength(2);
    });

    it('does not sync focused node ID when navigation is a no-op', () => {
      dispatchKeydown(win, 'ArrowUp', { altKey: true }); // root, no parent

      expect(treeView.setFocusedNodeIdCalls).toHaveLength(0);
    });

    it('syncs focused node ID before centering', () => {
      treeView.setZoomLevel(0.95);
      const child = tree.addChild(tree.rootId, 'https://child.com');
      tree.focusNode(child.id);

      dispatchKeydown(win, 'ArrowUp', { altKey: true });

      // setFocusedNodeId should be called, and centerOnNode should be called after
      expect(treeView.setFocusedNodeIdCalls).toContain(tree.rootId);
      expect(treeView.centerCalls).toContain(tree.rootId);
    });

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
    it('animates zoom to level 0 centered on focused node', () => {
      treeView.setZoomLevel(0.8);

      dispatchKeydown(win, '0', { ctrlKey: true });

      expect(treeView.animateToNodeCalls).toEqual([
        { nodeId: tree.focusedNodeId, level: 0 },
      ]);
    });

    it('prevents default and stops propagation', () => {
      const { defaultPrevented, propagationStopped } = dispatchKeydown(win, '0', { ctrlKey: true });

      expect(defaultPrevented).toBe(true);
      expect(propagationStopped).toBe(true);
    });
  });

  describe('Ctrl+1 - zoom to 100% on focused node', () => {
    it('animates to zoom level 1.0 centered on focused node', () => {
      treeView.setZoomLevel(0.5);

      dispatchKeydown(win, '1', { ctrlKey: true });

      expect(treeView.animateToNodeCalls).toEqual([
        { nodeId: tree.focusedNodeId, level: 1 },
      ]);
    });

    it('syncs focused node ID to tree view', () => {
      dispatchKeydown(win, '1', { ctrlKey: true });

      expect(treeView.setFocusedNodeIdCalls).toContain(tree.focusedNodeId);
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

    it('animates to focused node when zoomed out (level < 0.9)', () => {
      treeView.setZoomLevel(0.5);

      dispatchKeydown(win, 'Escape', {});

      expect(treeView.animateToNodeCalls).toEqual([
        { nodeId: tree.focusedNodeId, level: 1 },
      ]);
    });

    it('syncs focused node ID when zooming to focused node', () => {
      treeView.setZoomLevel(0.5);

      dispatchKeydown(win, 'Escape', {});

      expect(treeView.setFocusedNodeIdCalls).toContain(tree.focusedNodeId);
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

  describe('Ctrl+N - create new branch', () => {
    function createFakeTimer(): TimerPort {
      return {
        setTimeout: (cb: () => void) => { cb(); return 1; },
        clearTimeout: () => {},
        setInterval: () => 1,
        clearInterval: () => {},
      };
    }

    function setupWithBranchRouter() {
      const branchTree = new BrowsingTree('about:limb-home');
      const branchNav = new TreeNavigator(branchTree);
      const tabPort = new InMemoryTabPort();
      const bridge = new TabBridge(tabPort);
      const confirmPort = new InMemoryConfirmationPort();
      const autoSave = new AutoSaveTrigger(() => {}, createFakeTimer());
      const branchRouter = new BranchCommandRouter(
        branchTree,
        bridge,
        autoSave,
        confirmPort,
        'https://home.com',
      );
      const branchTreeView = createFakeTreeView();
      const branchUrlBar = createFakeUrlBar();
      const branchWin = createFakeWindow();
      const branchAdapter = new KeyboardNavigationAdapter(
        branchNav,
        branchTreeView,
        branchUrlBar,
        branchRouter,
      );
      branchAdapter.install(branchWin as unknown as Window);
      return { branchTree, branchTreeView, branchWin, tabPort, bridge };
    }

    it('creates a new branch on Ctrl+N', async () => {
      const { branchTree, branchWin } = setupWithBranchRouter();

      dispatchKeydown(branchWin, 'n', { ctrlKey: true });

      // Branch creation is async, wait for it
      await new Promise((r) => setTimeout(r, 0));

      const root = branchTree.nodes.get(branchTree.rootId)!;
      expect(root.childIds).toHaveLength(1);
    });

    it('zooms to the new branch node', async () => {
      const { branchTreeView, branchWin } = setupWithBranchRouter();

      dispatchKeydown(branchWin, 'n', { ctrlKey: true });
      await new Promise((r) => setTimeout(r, 0));

      expect(branchTreeView.animateToNodeCalls).toHaveLength(1);
      expect(branchTreeView.animateToNodeCalls[0].level).toBe(1);
    });

    it('prevents default and stops propagation', () => {
      const { branchWin } = setupWithBranchRouter();

      const { defaultPrevented, propagationStopped } = dispatchKeydown(
        branchWin,
        'n',
        { ctrlKey: true },
      );

      expect(defaultPrevented).toBe(true);
      expect(propagationStopped).toBe(true);
    });

    it('is a no-op when no branchRouter is provided', () => {
      // The default adapter from beforeEach has no branchRouter
      const { defaultPrevented } = dispatchKeydown(win, 'n', { ctrlKey: true });

      expect(defaultPrevented).toBe(false);
    });
  });

  describe('Ctrl+, — open settings', () => {
    it('calls openSettings callback on Ctrl+,', () => {
      let called = false;
      const settingsAdapter = new KeyboardNavigationAdapter(
        nav, treeView, urlBar, null, () => { called = true; },
      );
      const settingsWin = createFakeWindow();
      settingsAdapter.install(settingsWin as unknown as Window);

      dispatchKeydown(settingsWin, ',', { ctrlKey: true });

      expect(called).toBe(true);
    });

    it('prevents default and stops propagation', () => {
      const settingsAdapter = new KeyboardNavigationAdapter(
        nav, treeView, urlBar, null, () => {},
      );
      const settingsWin = createFakeWindow();
      settingsAdapter.install(settingsWin as unknown as Window);

      const { defaultPrevented, propagationStopped } = dispatchKeydown(
        settingsWin, ',', { ctrlKey: true },
      );

      expect(defaultPrevented).toBe(true);
      expect(propagationStopped).toBe(true);
    });

    it('is a no-op when no openSettings callback is provided', () => {
      const { defaultPrevented } = dispatchKeydown(win, ',', { ctrlKey: true });

      expect(defaultPrevented).toBe(false);
    });
  });

  describe('Ctrl+K — open search', () => {
    it('calls openSearch callback on Ctrl+K', () => {
      let called = false;
      const searchAdapter = new KeyboardNavigationAdapter(
        nav, treeView, urlBar, null, null, () => { called = true; },
      );
      const searchWin = createFakeWindow();
      searchAdapter.install(searchWin as unknown as Window);

      dispatchKeydown(searchWin, 'k', { ctrlKey: true });

      expect(called).toBe(true);
    });

    it('prevents default and stops propagation', () => {
      const searchAdapter = new KeyboardNavigationAdapter(
        nav, treeView, urlBar, null, null, () => {},
      );
      const searchWin = createFakeWindow();
      searchAdapter.install(searchWin as unknown as Window);

      const { defaultPrevented, propagationStopped } = dispatchKeydown(
        searchWin, 'k', { ctrlKey: true },
      );

      expect(defaultPrevented).toBe(true);
      expect(propagationStopped).toBe(true);
    });

    it('is a no-op when no openSearch callback is provided', () => {
      const { defaultPrevented } = dispatchKeydown(win, 'k', { ctrlKey: true });

      expect(defaultPrevented).toBe(false);
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
