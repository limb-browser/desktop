export interface SettingsProbe {
  settingChanged(key: string, oldValue: unknown, newValue: unknown): void;
}
