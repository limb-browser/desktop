// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export interface TabCommandRouterProbe {
  newTabRouted(parentId: string, childId: string): void;
  closeTabRouted(nodeId: string): void;
  orphanTabBlocked(): void;
  linkIntercepted(parentId: string, childId: string): void;
}
