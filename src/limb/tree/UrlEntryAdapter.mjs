// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Browser chrome adapter that wires UrlEntryRouter to Firefox's
 * urlbar submission handler.
 *
 * Intercepts gURLBar.handleCommand so that URL entry follows the
 * tree branching decision logic (navigation.md S2.3):
 * - about:limb-* URLs navigate in-place.
 * - Fresh nodes (no children, visited < 5s ago) navigate in-place.
 * - Otherwise, a new child node is created.
 *
 * When navigating in-place, the original handleCommand proceeds
 * (Firefox loads the URL in the current tab; task-013 handles
 * updating the tree node).
 * When creating a child, the original handleCommand is suppressed
 * (the router has already created the child node and tab).
 *
 * Loaded as a chrome ES module from browser-init-js.patch.
 */

import { UrlEntryRouter } from "./UrlEntryRouter.mjs";

export class UrlEntryAdapter {
  /** @type {UrlEntryRouter<*>} */
  #router;
  /** @type {*} */
  #urlbar = null;
  /** @type {Function | null} */
  #originalHandleCommand = null;

  /**
   * @param {UrlEntryRouter<*>} router
   */
  constructor(router) {
    this.#router = router;
  }

  /**
   * Install URL entry interception on the given urlbar.
   * @param {*} urlbar - the gURLBar object
   */
  install(urlbar) {
    this.#urlbar = urlbar;
    this.#originalHandleCommand = urlbar.handleCommand.bind(urlbar);
    urlbar.handleCommand = (event, where) => this.#onUrlSubmitted(event, where);
  }

  /**
   * @param {Event} event
   * @param {*} where
   */
  async #onUrlSubmitted(event, where) {
    const url = this.#urlbar.value.trim();
    const result = await this.#router.handleUrlEntry(url);
    if (result === "in-place") {
      this.#originalHandleCommand(event, where);
    }
  }

  uninstall() {
    if (this.#urlbar && this.#originalHandleCommand) {
      this.#urlbar.handleCommand = this.#originalHandleCommand;
    }
    this.#urlbar = null;
    this.#originalHandleCommand = null;
  }
}
