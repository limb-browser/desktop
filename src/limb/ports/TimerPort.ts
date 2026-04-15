// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export interface TimerPort {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}
