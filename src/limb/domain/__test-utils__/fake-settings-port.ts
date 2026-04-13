import type { SettingsPort } from '../../ports/settings-port';
import type { Settings } from '../../ports/settings-types';
import { DEFAULT_SETTINGS } from '../../ports/settings-types';

export class FakeSettingsPort implements SettingsPort {
  settings: Settings = { ...DEFAULT_SETTINGS };

  load(): Settings {
    return { ...this.settings };
  }

  save(settings: Settings): void {
    this.settings = { ...settings };
  }
}
