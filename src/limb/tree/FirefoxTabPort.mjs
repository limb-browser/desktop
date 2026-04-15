// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Firefox chrome implementation of TabPort.
 * Wraps gBrowser tab management APIs for use by TabBridge.
 *
 * See spec tab-bridge.md.
 */

export class FirefoxTabPort {
  /** @type {object} */
  #gBrowser;

  /** @param {object} gBrowser */
  constructor(gBrowser) {
    this.#gBrowser = gBrowser;
  }

  /**
   * @param {string} url
   * @param {string} nodeId
   * @returns {Promise<object>}
   */
  async openTab(url, nodeId) {
    const tab = this.#gBrowser.addTab(url, {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
    tab.setAttribute("limb-node-id", nodeId);
    return tab;
  }

  /**
   * @param {object} tab
   * @returns {Promise<void>}
   */
  async closeTab(tab) {
    this.#gBrowser.removeTab(tab);
  }

  /**
   * @param {object} tab
   * @returns {Promise<void>}
   */
  async selectTab(tab) {
    this.#gBrowser.selectedTab = tab;
  }

  /**
   * @param {object} tab
   * @returns {Promise<void>}
   */
  async suspendTab(tab) {
    this.#gBrowser.discardBrowser(tab);
  }

  /**
   * @param {object} tab
   * @returns {Promise<void>}
   */
  async restoreTab(tab) {
    const browser = tab.linkedBrowser;
    if (browser && browser.currentURI?.spec === "about:blank") {
      const url = tab.getAttribute("limb-original-url");
      if (url) {
        browser.loadURI(Services.io.newURI(url), {
          triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        });
      }
    }
  }

  /**
   * @param {object} tab
   * @returns {Promise<boolean>}
   */
  async isTabSuspended(tab) {
    const browser = tab.linkedBrowser;
    return !browser || !browser.isConnected;
  }

  /**
   * @param {object} tab
   * @param {string | null} parentId
   * @param {number} createdAt
   */
  setTreeAttributes(tab, parentId, createdAt) {
    if (parentId !== null) {
      tab.setAttribute("limb-tree-parent-id", parentId);
    }
    tab.setAttribute("limb-tree-created-at", String(createdAt));
  }
}
