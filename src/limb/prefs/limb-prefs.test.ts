// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';

interface Pref {
  name: string;
  value: string | number | boolean;
  type?: string;
  locked?: boolean;
}

const YAML_PATH = resolve(__dirname, '../../../prefs/limb/limb.yaml');

function loadLimbPrefs(): Pref[] {
  const content = readFileSync(YAML_PATH, 'utf-8');
  return parse(content) as Pref[];
}

describe('limb.yaml preferences', () => {
  it('defines limb.home.url as string defaulting to about:blank', () => {
    const prefs = loadLimbPrefs();
    const pref = prefs.find((p) => p.name === 'limb.home.url');
    expect(pref).toBeDefined();
    expect(pref!.value).toBe('about:blank');
  });

  it('defines limb.tree.max-live-tabs as int defaulting to 8', () => {
    const prefs = loadLimbPrefs();
    const pref = prefs.find((p) => p.name === 'limb.tree.max-live-tabs');
    expect(pref).toBeDefined();
    expect(pref!.value).toBe(8);
  });

  it('defines limb.screenshots.retention-days as int defaulting to 7', () => {
    const prefs = loadLimbPrefs();
    const pref = prefs.find((p) => p.name === 'limb.screenshots.retention-days');
    expect(pref).toBeDefined();
    expect(pref!.value).toBe(7);
  });

  it('contains exactly 3 preferences', () => {
    const prefs = loadLimbPrefs();
    expect(prefs).toHaveLength(3);
  });

  it('all pref names start with limb.', () => {
    const prefs = loadLimbPrefs();
    for (const pref of prefs) {
      expect(pref.name).toMatch(/^limb\./);
    }
  });
});
