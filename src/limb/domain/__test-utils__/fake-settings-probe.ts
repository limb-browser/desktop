import type { SettingsProbe } from '../../ports/settings-probe';

export interface SettingChange {
  key: string;
  oldValue: unknown;
  newValue: unknown;
}

export class FakeSettingsProbe implements SettingsProbe {
  changes: SettingChange[] = [];

  settingChanged(key: string, oldValue: unknown, newValue: unknown): void {
    this.changes.push({ key, oldValue, newValue });
  }
}
