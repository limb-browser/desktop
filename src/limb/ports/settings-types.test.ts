import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from './settings-types';

describe('DEFAULT_SETTINGS', () => {
  it('has homeUrl set to about:blank', () => {
    expect(DEFAULT_SETTINGS.homeUrl).toBe('about:blank');
  });

  it('has maxLiveWebviews set to 6', () => {
    expect(DEFAULT_SETTINGS.maxLiveWebviews).toBe(6);
  });

  it('has screenshotRetentionDays set to 7', () => {
    expect(DEFAULT_SETTINGS.screenshotRetentionDays).toBe(7);
  });
});
