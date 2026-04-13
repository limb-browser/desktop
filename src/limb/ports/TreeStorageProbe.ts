// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

export interface TreeStorageProbe {
  branchSaved(branchRootId: string, nodeCount: number): void;
  branchLoaded(branchRootId: string, nodeCount: number): void;
  branchDeleted(branchRootId: string): void;
  screenshotSaved(nodeId: string, resolution: string, byteSize: number): void;
  screenshotLoaded(nodeId: string, resolution: string): void;
  screenshotsDeleted(nodeIds: string[]): void;
}
