// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { TreeSizeNotificationHandler } from './TreeSizeNotificationHandler';
import type {
  NotificationPort,
  NotificationAction,
} from '../ports/NotificationPort';

function createFakeNotificationPort(): NotificationPort & {
  notifications: { message: string; actions?: NotificationAction[] }[];
} {
  const notifications: { message: string; actions?: NotificationAction[] }[] =
    [];
  return {
    notifications,
    showNotification(message: string, actions?: NotificationAction[]) {
      notifications.push({ message, actions });
    },
  };
}

describe('TreeSizeNotificationHandler', () => {
  it('shows warning notification with correct message on treeSizeWarning', () => {
    const port = createFakeNotificationPort();
    const handler = new TreeSizeNotificationHandler(port, () => {});
    handler.onTreeSizeWarning(101);
    expect(port.notifications).toHaveLength(1);
    expect(port.notifications[0].message).toBe(
      'Your tree has 100+ pages. Consider closing unused branches for best performance.'
    );
  });

  it('shows suggestion notification with correct message on treeSizeSuggestion', () => {
    const port = createFakeNotificationPort();
    const handler = new TreeSizeNotificationHandler(port, () => {});
    handler.onTreeSizeSuggestion(201);
    expect(port.notifications).toHaveLength(1);
    expect(port.notifications[0].message).toBe(
      'Your tree has 200+ pages. Close some branches to free memory.'
    );
  });

  it('includes a "Show branches" action on treeSizeSuggestion', () => {
    const port = createFakeNotificationPort();
    const onShowBranches = () => {};
    const handler = new TreeSizeNotificationHandler(port, onShowBranches);
    handler.onTreeSizeSuggestion(201);
    expect(port.notifications[0].actions).toBeDefined();
    expect(port.notifications[0].actions).toHaveLength(1);
    expect(port.notifications[0].actions![0].label).toBe('Show branches');
  });

  it('invokes injected onShowBranches callback when "Show branches" action is triggered', () => {
    const port = createFakeNotificationPort();
    let called = false;
    const onShowBranches = () => {
      called = true;
    };
    const handler = new TreeSizeNotificationHandler(port, onShowBranches);
    handler.onTreeSizeSuggestion(201);
    port.notifications[0].actions![0].callback();
    expect(called).toBe(true);
  });

  it('does not include actions on treeSizeWarning', () => {
    const port = createFakeNotificationPort();
    const handler = new TreeSizeNotificationHandler(port, () => {});
    handler.onTreeSizeWarning(101);
    expect(port.notifications[0].actions).toBeUndefined();
  });
});
