import { describe, it, expect } from 'vitest';
import { FakeSettingsProbe } from './fake-settings-probe';

describe('FakeSettingsProbe', () => {
  it('records settingChanged calls', () => {
    const probe = new FakeSettingsProbe();
    probe.settingChanged('homeUrl', 'about:blank', 'https://example.com');
    expect(probe.changes).toEqual([
      { key: 'homeUrl', oldValue: 'about:blank', newValue: 'https://example.com' },
    ]);
  });

  it('records multiple settingChanged calls', () => {
    const probe = new FakeSettingsProbe();
    probe.settingChanged('homeUrl', 'about:blank', 'https://a.com');
    probe.settingChanged('maxLiveWebviews', 6, 10);
    expect(probe.changes).toEqual([
      { key: 'homeUrl', oldValue: 'about:blank', newValue: 'https://a.com' },
      { key: 'maxLiveWebviews', oldValue: 6, newValue: 10 },
    ]);
  });

  it('starts with empty changes', () => {
    const probe = new FakeSettingsProbe();
    expect(probe.changes).toEqual([]);
  });
});
