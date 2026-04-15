// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Browser adapter that wires AddressBarVisibility (domain) to the
 * Firefox chrome DOM.
 *
 * Responsibilities:
 * - Implements AddressBarVisibilityProbe: applies opacity and
 *   pointer-events to #nav-bar via CSS custom properties.
 * - Intercepts Ctrl+L: when the address bar is fully hidden
 *   (zoom < 0.85), auto-zooms to 0.95 before letting the
 *   default focus-urlbar behavior proceed.
 *
 * Loaded as a chrome ES module from browser-init-js.patch.
 */

import { AddressBarVisibility } from "./AddressBarVisibility.mjs";

export class AddressBarAdapter {
  /** @type {AddressBarVisibility} */
  #visibility;
  /** @type {HTMLElement | null} */
  #navBar;
  /** @type {{ setZoomLevel(level: number): void, zoomLevel: number } | null} */
  #treeView;
  /** @type {((e: KeyboardEvent) => void) | null} */
  #keyHandler = null;

  /**
   * @param {HTMLElement} navBar - The #nav-bar element
   * @param {{ setZoomLevel(level: number): void, zoomLevel: number }} treeView - LimbTreeView instance
   */
  constructor(navBar, treeView) {
    this.#navBar = navBar;
    this.#treeView = treeView;
    this.#visibility = new AddressBarVisibility(this);
  }

  /**
   * The ZoomProbe facade: forward zoom events to AddressBarVisibility.
   * Pass this object as the ZoomProbe when initializing LimbTreeView.
   * @returns {{ zoomChanged(level: number, zoomScale: number): void }}
   */
  get zoomProbe() {
    return this.#visibility;
  }

  /**
   * Start listening for Ctrl+L keyboard events.
   * Must be called after the adapter is constructed and the tree view
   * is initialized.
   */
  attach() {
    this.#visibility.zoomChanged(this.#treeView.zoomLevel, 0);
    this.#keyHandler = (e) => this.#onKeyDown(e);
    this.#navBar?.ownerDocument.defaultView?.addEventListener(
      "keydown",
      this.#keyHandler,
      true,
    );
  }

  /**
   * AddressBarVisibilityProbe implementation.
   * Updates CSS custom properties on #nav-bar.
   * @param {number} opacity
   * @param {boolean} interactive
   */
  visibilityChanged(opacity, interactive) {
    if (!this.#navBar) return;
    this.#navBar.style.setProperty("--limb-addressbar-opacity", String(opacity));
    this.#navBar.style.setProperty(
      "--limb-addressbar-pointer-events",
      interactive ? "auto" : "none",
    );
  }

  /**
   * Handle Ctrl+L: auto-zoom to reveal the address bar when hidden.
   * @param {KeyboardEvent} e
   */
  #onKeyDown(e) {
    if (e.key !== "l" || !e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) {
      return;
    }
    if (!this.#treeView) return;

    if (this.#visibility.shouldAutoZoom(this.#treeView.zoomLevel)) {
      this.#treeView.setZoomLevel(this.#visibility.autoZoomTarget);
    }
    // Let the default Ctrl+L behavior (focus urlbar) proceed.
  }

  destroy() {
    if (this.#keyHandler) {
      this.#navBar?.ownerDocument.defaultView?.removeEventListener(
        "keydown",
        this.#keyHandler,
        true,
      );
      this.#keyHandler = null;
    }
    this.#navBar = null;
    this.#treeView = null;
  }
}
