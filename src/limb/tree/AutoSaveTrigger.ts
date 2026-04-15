// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { AutoSaveProbe } from '../ports/AutoSaveProbe';
import type { TimerPort } from '../ports/TimerPort';

const DEBOUNCE_MS = 1000;
const PERIODIC_FLUSH_MS = 30_000;

export class AutoSaveTrigger {
  #saveFn: () => void;
  #timer: TimerPort;
  #probe: AutoSaveProbe | null;
  #debounceId: unknown = null;
  #periodicId: unknown = null;
  #pendingCount = 0;

  constructor(saveFn: () => void, timer: TimerPort, probe?: AutoSaveProbe) {
    this.#saveFn = saveFn;
    this.#timer = timer;
    this.#probe = probe ?? null;
  }

  notifyChange(): void {
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

  startPeriodicFlush(): void {
    if (this.#periodicId !== null) return;

    this.#periodicId = this.#timer.setInterval(() => {
      this.#saveFn();
      this.#probe?.saveTriggered('periodic');
    }, PERIODIC_FLUSH_MS);

    this.#probe?.periodicFlushStarted();
  }

  stopPeriodicFlush(): void {
    if (this.#periodicId === null) return;

    this.#timer.clearInterval(this.#periodicId);
    this.#periodicId = null;
    this.#probe?.periodicFlushStopped();
  }

  saveNow(): void {
    if (this.#debounceId !== null) {
      this.#timer.clearTimeout(this.#debounceId);
      this.#debounceId = null;
      this.#pendingCount = 0;
    }
    this.#saveFn();
    this.#probe?.saveTriggered('shutdown');
  }

  dispose(): void {
    if (this.#debounceId !== null) {
      this.#timer.clearTimeout(this.#debounceId);
      this.#debounceId = null;
    }
    this.stopPeriodicFlush();
    this.#pendingCount = 0;
  }
}
