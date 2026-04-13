export interface Settings {
  homeUrl: string;
  maxLiveWebviews: number;
  screenshotRetentionDays: number;
}

export const DEFAULT_SETTINGS: Settings = {
  homeUrl: 'about:blank',
  maxLiveWebviews: 6,
  screenshotRetentionDays: 7,
};
