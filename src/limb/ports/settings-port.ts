import type { Settings } from './settings-types';

export interface SettingsPort {
  load(): Settings;
  save(settings: Settings): void;
}
