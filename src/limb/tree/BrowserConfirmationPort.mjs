// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Browser chrome implementation of ConfirmationPort.
 * Uses window.confirm() for simple confirmation dialogs.
 *
 * See spec unified-tree.md S2.4.
 */

export class BrowserConfirmationPort {
  /** @type {Window} */
  #window;

  /** @param {Window} win */
  constructor(win) {
    this.#window = win;
  }

  /**
   * @param {string} message
   * @returns {Promise<boolean>}
   */
  async confirm(message) {
    return this.#window.confirm(message);
  }
}
