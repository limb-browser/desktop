// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { NotificationPort } from '../ports/NotificationPort';

export class TreeSizeNotificationHandler {
  #notificationPort: NotificationPort;

  constructor(notificationPort: NotificationPort) {
    this.#notificationPort = notificationPort;
  }

  onTreeSizeWarning(_nodeCount: number): void {
    this.#notificationPort.showNotification(
      'Your tree has 100+ pages. Consider closing unused branches for best performance.'
    );
  }

  onTreeSizeSuggestion(_nodeCount: number): void {
    this.#notificationPort.showNotification(
      'Your tree has 200+ pages. Close some branches to free memory.',
      [{ label: 'Show branches', callback: () => {} }]
    );
  }
}
