// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { FakeTimerPort } from './FakeTimerPort';

describe('FakeTimerPort', () => {
  let timer: FakeTimerPort;

  beforeEach(() => {
    timer = new FakeTimerPort();
  });

  describe('setTimeout', () => {
    it('fires callback after specified delay', () => {
      let fired = false;
      timer.setTimeout(() => { fired = true; }, 100);

      timer.advance(99);
      expect(fired).toBe(false);

      timer.advance(1);
      expect(fired).toBe(true);
    });

    it('does not fire after clearTimeout', () => {
      let fired = false;
      const id = timer.setTimeout(() => { fired = true; }, 100);

      timer.clearTimeout(id);
      timer.advance(200);
      expect(fired).toBe(false);
    });

    it('decrements pendingTimeoutCount after firing', () => {
      timer.setTimeout(() => {}, 100);
      expect(timer.pendingTimeoutCount).toBe(1);

      timer.advance(100);
      expect(timer.pendingTimeoutCount).toBe(0);
    });
  });

  describe('setInterval', () => {
    it('fires callback repeatedly at interval', () => {
      let count = 0;
      timer.setInterval(() => { count++; }, 50);

      timer.advance(50);
      expect(count).toBe(1);

      timer.advance(50);
      expect(count).toBe(2);

      timer.advance(50);
      expect(count).toBe(3);
    });

    it('stops on clearInterval', () => {
      let count = 0;
      const id = timer.setInterval(() => { count++; }, 50);

      timer.advance(50);
      expect(count).toBe(1);

      timer.clearInterval(id);
      timer.advance(100);
      expect(count).toBe(1);
    });

    it('decrements pendingIntervalCount after clearInterval', () => {
      const id = timer.setInterval(() => {}, 50);
      expect(timer.pendingIntervalCount).toBe(1);

      timer.clearInterval(id);
      expect(timer.pendingIntervalCount).toBe(0);
    });
  });

  describe('ordering', () => {
    it('fires events in chronological order', () => {
      const order: string[] = [];
      timer.setTimeout(() => { order.push('a'); }, 200);
      timer.setTimeout(() => { order.push('b'); }, 100);
      timer.setTimeout(() => { order.push('c'); }, 300);

      timer.advance(300);
      expect(order).toEqual(['b', 'a', 'c']);
    });
  });
});
