import { describe, it, expect } from 'vitest';
import { FakeSettingsPort } from './fake-settings-port';
import { DEFAULT_SETTINGS } from '../../ports/settings-types';
import type { Settings } from '../../ports/settings-types';

describe('FakeSettingsPort', () => {
  it('returns DEFAULT_SETTINGS on initial load', () => {
    const port = new FakeSettingsPort();
    expect(port.load()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips settings correctly', () => {
    const port = new FakeSettingsPort();
    const custom: Settings = {
      homeUrl: 'https://example.com',
      maxLiveWebviews: 10,
    };
    port.save(custom);
    expect(port.load()).toEqual(custom);
  });

  it('preserves settings across multiple saves', () => {
    const port = new FakeSettingsPort();
    port.save({ homeUrl: 'https://first.com', maxLiveWebviews: 3 });
    port.save({ homeUrl: 'https://second.com', maxLiveWebviews: 8 });
    expect(port.load()).toEqual({
      homeUrl: 'https://second.com',
      maxLiveWebviews: 8,
    });
  });
});
