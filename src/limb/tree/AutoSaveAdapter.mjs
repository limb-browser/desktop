// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Browser chrome adapter that wires AutoSaveTrigger to BrowsingTree
 * probes, TabBridge probes, periodic flush, and browser quit events.
 *
 * Triggers a SessionStore flush on tree mutations, URL/title changes,
 * periodically (30 s), and before shutdown.
 *
 * See spec persistence.md S3.
 */

import { AutoSaveTrigger } from "./AutoSaveTrigger.ts";

const windowTimers = {
  setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
  setInterval: (cb, ms) => globalThis.setInterval(cb, ms),
  clearInterval: (id) => globalThis.clearInterval(id),
};

export class AutoSaveAdapter {
  /** @type {AutoSaveTrigger} */
  #trigger;
  /** @type {object | null} */
  #browsingTree = null;
  /** @type {boolean} */
  #installed = false;

  /**
   * @param {() => void} saveFn  - function that flushes tree state to SessionStore
   * @param {object} [probe]     - optional AutoSaveProbe for observability
   */
  constructor(saveFn, probe) {
    this.#trigger = new AutoSaveTrigger(saveFn, windowTimers, probe);
  }

  /**
   * Install auto-save hooks on the given tree and start periodic flush.
   *
   * Sets a BrowsingTreeProbe on the tree that triggers saves on
   * addChild, removeNode, and focusNode. Also registers a
   * quit-application-requested observer for shutdown save.
   *
   * @param {object} browsingTree - the BrowsingTree instance
   */
  install(browsingTree) {
    if (this.#installed) return;
    this.#installed = true;
    this.#browsingTree = browsingTree;

    browsingTree.setProbe({
      childAdded: () => this.#trigger.notifyChange(),
      nodeRemoved: () => this.#trigger.notifyChange(),
      nodeFocused: () => this.#trigger.notifyChange(),
      treeSizeWarning: () => {},
      treeSizeSuggestion: () => {},
    });

    Services.obs.addObserver(this, "quit-application-requested");
    this.#trigger.startPeriodicFlush();
  }

  /**
   * Notify the trigger that URL or title data changed.
   * Call this from wherever TabBridge location/title/favicon changes
   * are handled.
   */
  notifyDataChange() {
    this.#trigger.notifyChange();
  }

  /**
   * nsIObserver interface for quit-application-requested.
   * @param {*} _subject
   * @param {string} topic
   */
  observe(_subject, topic) {
    if (topic === "quit-application-requested") {
      this.#trigger.saveNow();
    }
  }

  uninstall() {
    if (!this.#installed) return;
    this.#installed = false;
    this.#trigger.dispose();
    Services.obs.removeObserver(this, "quit-application-requested");
    this.#browsingTree = null;
  }
}
