// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import type { ScreenshotCapturePort, ScreenshotImage } from '../ports/ScreenshotCapturePort';
import type { FakeTab } from './InMemoryTabPort';

export interface CaptureRecord {
  tab: FakeTab;
  width: number;
  quality: number;
}

export class InMemoryScreenshotCapturePort implements ScreenshotCapturePort<FakeTab> {
  captures: CaptureRecord[] = [];

  async capture(tab: FakeTab, width: number, quality: number): Promise<ScreenshotImage> {
    this.captures.push({ tab, width, quality });
    return { width, height: Math.round(width * 0.75) };
  }
}
