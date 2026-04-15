// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Browser chrome adapter that wires tree navigation keyboard shortcuts
 * to the TreeNavigator domain class and LimbTreeView zoom controls.
 *
 * Intercepts:
 * - Alt+Up/Down/Left/Right: tree structure navigation
 * - Ctrl+0: reset zoom to fit entire tree
 * - Ctrl+1: zoom to 100% centered on focused node
 * - Ctrl+N: create new branch (when branchRouter provided)
 * - Ctrl+,: open settings (when openSettings provided)
 * - Ctrl+K: open search (when openSearch provided)
 * - Escape: blur address bar or zoom to focused node
 *
 * See spec navigation.md S4.1, S4.2, S4.3; navigation.md S5.2.
 */

import { TreeNavigator } from "./TreeNavigator.ts";

export class KeyboardNavigationAdapter {
  /** @type {TreeNavigator} */
  #navigator;
  /** @type {{ zoomLevel: number, setZoomLevel(level: number): void, setFocusedNodeId(nodeId: string): void, centerOnNode(nodeId: string): void, animateToNode(nodeId: string, level: number): void }} */
  #treeView;
  /** @type {{ focused: boolean, blur(): void }} */
  #urlBar;
  /** @type {{ createBranch(): Promise<string> } | null} */
  #branchRouter;
  /** @type {(() => void) | null} */
  #openSettings;
  /** @type {(() => void) | null} */
  #openSearch;
  /** @type {((e: KeyboardEvent) => void) | null} */
  #keyHandler = null;
  /** @type {Window | null} */
  #window = null;

  /**
   * @param {TreeNavigator} navigator
   * @param {{ zoomLevel: number, setZoomLevel(level: number): void, setFocusedNodeId(nodeId: string): void, centerOnNode(nodeId: string): void, animateToNode(nodeId: string, level: number): void }} treeView
   * @param {{ focused: boolean, blur(): void }} urlBar
   * @param {{ createBranch(): Promise<string> } | null} [branchRouter]
   * @param {(() => void) | null} [openSettings]
   * @param {(() => void) | null} [openSearch]
   */
  constructor(navigator, treeView, urlBar, branchRouter = null, openSettings = null, openSearch = null) {
    this.#navigator = navigator;
    this.#treeView = treeView;
    this.#urlBar = urlBar;
    this.#branchRouter = branchRouter;
    this.#openSettings = openSettings;
    this.#openSearch = openSearch;
  }

  /**
   * Install keyboard interception on the given window.
   * @param {Window} win
   */
  install(win) {
    this.#window = win;
    this.#keyHandler = (e) => this.#onKeyDown(e);
    win.addEventListener("keydown", this.#keyHandler, true);
  }

  uninstall() {
    if (this.#keyHandler && this.#window) {
      this.#window.removeEventListener("keydown", this.#keyHandler, true);
    }
    this.#keyHandler = null;
    this.#window = null;
  }

  /** @param {KeyboardEvent} e */
  #onKeyDown(e) {
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      this.#handleTreeNavigation(e);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      this.#handleZoomShortcuts(e);
      return;
    }

    if (e.key === "Escape" && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      this.#handleEscape(e);
    }
  }

  /** @param {KeyboardEvent} e */
  #handleTreeNavigation(e) {
    /** @type {string | null} */
    let newNodeId = null;

    switch (e.key) {
      case "ArrowUp":
        newNodeId = this.#navigator.focusParent();
        break;
      case "ArrowDown":
        newNodeId = this.#navigator.focusFirstChild();
        break;
      case "ArrowLeft":
        newNodeId = this.#navigator.focusPreviousSibling();
        break;
      case "ArrowRight":
        newNodeId = this.#navigator.focusNextSibling();
        break;
      default:
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (newNodeId !== null) {
      this.#treeView.setFocusedNodeId(newNodeId);
      if (this.#treeView.zoomLevel >= 0.9) {
        this.#treeView.centerOnNode(newNodeId);
      }
    }
  }

  /** @param {KeyboardEvent} e */
  #handleZoomShortcuts(e) {
    if (e.key === "0") {
      e.preventDefault();
      e.stopPropagation();
      const focusedId = this.#navigator.focusedNodeId;
      this.#treeView.animateToNode(focusedId, 0);
    } else if (e.key === "1") {
      e.preventDefault();
      e.stopPropagation();
      const focusedId = this.#navigator.focusedNodeId;
      this.#treeView.setFocusedNodeId(focusedId);
      this.#treeView.animateToNode(focusedId, 1);
    } else if (e.key === "n" && this.#branchRouter) {
      e.preventDefault();
      e.stopPropagation();
      this.#branchRouter.createBranch().then((nodeId) => {
        this.#treeView.setFocusedNodeId(nodeId);
        this.#treeView.animateToNode(nodeId, 1);
      });
    } else if (e.key === "," && this.#openSettings) {
      e.preventDefault();
      e.stopPropagation();
      this.#openSettings();
    } else if (e.key === "k" && this.#openSearch) {
      e.preventDefault();
      e.stopPropagation();
      this.#openSearch();
    }
  }

  /** @param {KeyboardEvent} e */
  #handleEscape(e) {
    if (this.#urlBar.focused) {
      e.preventDefault();
      e.stopPropagation();
      this.#urlBar.blur();
      return;
    }

    if (this.#treeView.zoomLevel < 0.9) {
      e.preventDefault();
      e.stopPropagation();
      const focusedId = this.#navigator.focusedNodeId;
      this.#treeView.setFocusedNodeId(focusedId);
      this.#treeView.animateToNode(focusedId, 1);
    }
  }
}
