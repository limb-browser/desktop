// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryScreenshotCapturePort } from './InMemoryScreenshotCapturePort';
import type { FakeTab } from './InMemoryTabPort';

describe('InMemoryScreenshotCapturePort', () => {
  let port: InMemoryScreenshotCapturePort;

  beforeEach(() => {
    port = new InMemoryScreenshotCapturePort();
  });

  it('returns an image with the requested width', async () => {
    const tab: FakeTab = { url: 'https://example.com', nodeId: 'n1', closed: false, suspended: false };
    const image = await port.capture(tab, 1024, 85);
    expect(image.width).toBe(1024);
  });

  it('returns an image with proportional height', async () => {
    const tab: FakeTab = { url: 'https://example.com', nodeId: 'n1', closed: false, suspended: false };
    const image = await port.capture(tab, 320, 60);
    expect(image.height).toBe(240);
  });

  it('records each capture call', async () => {
    const tab: FakeTab = { url: 'https://example.com', nodeId: 'n1', closed: false, suspended: false };
    await port.capture(tab, 1024, 85);
    await port.capture(tab, 320, 60);
    expect(port.captures).toHaveLength(2);
    expect(port.captures[0]).toEqual({ tab, width: 1024, quality: 85 });
    expect(port.captures[1]).toEqual({ tab, width: 320, quality: 60 });
  });
});
