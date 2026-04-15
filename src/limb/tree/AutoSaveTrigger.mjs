// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const DEBOUNCE_MS = 1000;
const PERIODIC_FLUSH_MS = 30_000;

export class AutoSaveTrigger {
  #saveFn;
  #timer;
  #probe;
  #debounceId = null;
  #periodicId = null;
  #pendingCount = 0;

  constructor(saveFn, timer, probe) {
    this.#saveFn = saveFn;
    this.#timer = timer;
    this.#probe = probe ?? null;
  }

  notifyChange() {
    this.#pendingCount++;

    if (this.#debounceId !== null) {
      this.#timer.clearTimeout(this.#debounceId);
      this.#probe?.saveDebounced(this.#pendingCount);
    }

    this.#debounceId = this.#timer.setTimeout(() => {
      this.#debounceId = null;
      this.#pendingCount = 0;
      this.#saveFn();
      this.#probe?.saveTriggered('change');
    }, DEBOUNCE_MS);
  }

  startPeriodicFlush() {
    if (this.#periodicId !== null) return;

    this.#periodicId = this.#timer.setInterval(() => {
      this.#saveFn();
      this.#probe?.saveTriggered('periodic');
    }, PERIODIC_FLUSH_MS);

    this.#probe?.periodicFlushStarted();
  }

  stopPeriodicFlush() {
    if (this.#periodicId === null) return;

    this.#timer.clearInterval(this.#periodicId);
    this.#periodicId = null;
    this.#probe?.periodicFlushStopped();
  }

  saveNow() {
    if (this.#debounceId !== null) {
      this.#timer.clearTimeout(this.#debounceId);
      this.#debounceId = null;
      this.#pendingCount = 0;
    }
    this.#saveFn();
    this.#probe?.saveTriggered('shutdown');
  }

  dispose() {
    if (this.#debounceId !== null) {
      this.#timer.clearTimeout(this.#debounceId);
      this.#debounceId = null;
    }
    this.stopPeriodicFlush();
    this.#pendingCount = 0;
  }
}
