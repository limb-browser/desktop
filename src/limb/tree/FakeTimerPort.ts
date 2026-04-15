// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { TimerPort } from '../ports/TimerPort';

interface PendingTimeout {
  callback: () => void;
  fireAt: number;
  id: number;
}

interface PendingInterval {
  callback: () => void;
  intervalMs: number;
  nextFireAt: number;
  id: number;
}

export class FakeTimerPort implements TimerPort {
  #now = 0;
  #nextId = 1;
  #timeouts: PendingTimeout[] = [];
  #intervals: PendingInterval[] = [];

  get now(): number {
    return this.#now;
  }

  setTimeout(callback: () => void, ms: number): number {
    const id = this.#nextId++;
    this.#timeouts.push({ callback, fireAt: this.#now + ms, id });
    return id;
  }

  clearTimeout(id: unknown): void {
    this.#timeouts = this.#timeouts.filter((t) => t.id !== id);
  }

  setInterval(callback: () => void, ms: number): number {
    const id = this.#nextId++;
    this.#intervals.push({
      callback,
      intervalMs: ms,
      nextFireAt: this.#now + ms,
      id,
    });
    return id;
  }

  clearInterval(id: unknown): void {
    this.#intervals = this.#intervals.filter((i) => i.id !== id);
  }

  advance = (ms: number): void => {
    const targetTime = this.#now + ms;

    while (this.#now < targetTime) {
      // Find the next event to fire
      let nextTime = targetTime;

      for (const t of this.#timeouts) {
        if (t.fireAt <= targetTime && t.fireAt < nextTime) {
          nextTime = t.fireAt;
        }
      }
      for (const i of this.#intervals) {
        if (i.nextFireAt <= targetTime && i.nextFireAt < nextTime) {
          nextTime = i.nextFireAt;
        }
      }

      this.#now = nextTime;

      // Fire all timeouts at this time
      const readyTimeouts = this.#timeouts.filter((t) => t.fireAt <= this.#now);
      this.#timeouts = this.#timeouts.filter((t) => t.fireAt > this.#now);
      for (const t of readyTimeouts) {
        t.callback();
      }

      // Fire all intervals at this time
      for (const i of this.#intervals) {
        if (i.nextFireAt <= this.#now) {
          i.callback();
          i.nextFireAt += i.intervalMs;
        }
      }

      if (nextTime === targetTime) break;
    }
  };

  get pendingTimeoutCount(): number {
    return this.#timeouts.length;
  }

  get pendingIntervalCount(): number {
    return this.#intervals.length;
  }
}
