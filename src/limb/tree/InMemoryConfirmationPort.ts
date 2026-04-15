// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { ConfirmationPort } from '../ports/ConfirmationPort';

export class InMemoryConfirmationPort implements ConfirmationPort {
  nextResponse = true;
  calls: string[] = [];

  async confirm(message: string): Promise<boolean> {
    this.calls.push(message);
    return this.nextResponse;
  }
}
