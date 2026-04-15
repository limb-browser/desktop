// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { PrefsPort } from '../ports/PrefsPort';

export class InMemoryPrefsPort implements PrefsPort {
  #strings = new Map<string, string>();
  #ints = new Map<string, number>();

  getStringPref(key: string, defaultValue: string): string {
    return this.#strings.get(key) ?? defaultValue;
  }

  getIntPref(key: string, defaultValue: number): number {
    return this.#ints.get(key) ?? defaultValue;
  }

  setStringPref(key: string, value: string): void {
    this.#strings.set(key, value);
  }

  setIntPref(key: string, value: number): void {
    this.#ints.set(key, value);
  }
}
