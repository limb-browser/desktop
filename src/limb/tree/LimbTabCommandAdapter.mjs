// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Browser chrome adapter that wires TabCommandRouter to Firefox's
 * keyboard commands and tab events.
 *
 * Intercepts:
 * - Ctrl+T / Cmd+T: routes through tree model (addChild) instead of
 *   Firefox's default new-tab behavior.
 * - Ctrl+W / Cmd+W: routes through tree model (removeNode) instead of
 *   Firefox's direct tab close.
 * - TabOpen events: blocks orphan tabs created outside the tree model.
 *
 * See spec tab-bridge.md S4.3, S4.4.
 */

import { TabCommandRouter } from "./TabCommandRouter.ts";

export class LimbTabCommandAdapter {
  /** @type {TabCommandRouter<*>} */
  #router;
  /** @type {((e: KeyboardEvent) => void) | null} */
  #keyHandler = null;
  /** @type {((e: Event) => void) | null} */
  #tabOpenHandler = null;
  /** @type {Window | null} */
  #window = null;
  /** @type {EventTarget | null} */
  #tabContainer = null;

  /**
   * @param {TabCommandRouter<*>} router
   */
  constructor(router) {
    this.#router = router;
  }

  /**
   * Install command interception on the given window and tab container.
   * @param {Window} win - the browser chrome window
   * @param {EventTarget} tabContainer - gBrowser.tabContainer
   */
  install(win, tabContainer) {
    this.#window = win;
    this.#tabContainer = tabContainer;

    this.#keyHandler = (e) => this.#onKeyDown(e);
    this.#tabOpenHandler = (e) => this.#onTabOpen(e);

    win.addEventListener("keydown", this.#keyHandler, true);
    tabContainer.addEventListener("TabOpen", this.#tabOpenHandler);
  }

  uninstall() {
    if (this.#keyHandler && this.#window) {
      this.#window.removeEventListener("keydown", this.#keyHandler, true);
    }
    if (this.#tabOpenHandler && this.#tabContainer) {
      this.#tabContainer.removeEventListener("TabOpen", this.#tabOpenHandler);
    }
    this.#keyHandler = null;
    this.#tabOpenHandler = null;
    this.#window = null;
    this.#tabContainer = null;
  }

  /**
   * @param {KeyboardEvent} e
   */
  #onKeyDown(e) {
    const accel = e.metaKey || e.ctrlKey;
    if (!accel) return;

    if (e.key === "t") {
      e.preventDefault();
      e.stopPropagation();
      this.#router.handleNewTab();
    } else if (e.key === "w") {
      e.preventDefault();
      e.stopPropagation();
      this.#router.handleCloseTab();
    }
  }

  /**
   * @param {Event} e
   */
  #onTabOpen(e) {
    this.#router.handleExternalTabOpen(e.target);
  }
}
