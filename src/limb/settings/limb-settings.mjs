// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Settings page controller for about:limb-settings.
 *
 * Runs in the privileged about: page context. Binds UI inputs to
 * Firefox preferences via a SettingsController, applying changes immediately.
 *
 * See spec settings.md S3.
 */

const { SettingsController } = ChromeUtils.importESModule(
  "chrome://browser/content/limb/settings/SettingsController.mjs",
  { global: "current" }
);

function init() {
  const prefs = {
    getStringPref(key, defaultValue) { return Services.prefs.getStringPref(key, defaultValue); },
    getIntPref(key, defaultValue) { return Services.prefs.getIntPref(key, defaultValue); },
    setStringPref(key, value) { Services.prefs.setStringPref(key, value); },
    setIntPref(key, value) { Services.prefs.setIntPref(key, value); },
  };

  const controller = new SettingsController(prefs);

  const homepageInput = document.getElementById("homepage");
  const maxLiveTabsInput = document.getElementById("max-live-tabs");

  // Load current values from prefs
  homepageInput.value = controller.homepage;
  maxLiveTabsInput.value = controller.maxLiveTabs;

  // Two-way binding: input changes write to prefs immediately
  homepageInput.addEventListener("input", () => {
    controller.homepage = homepageInput.value;
  });

  maxLiveTabsInput.addEventListener("input", () => {
    const raw = parseInt(maxLiveTabsInput.value, 10);
    if (Number.isNaN(raw)) return;
    controller.maxLiveTabs = raw;
    maxLiveTabsInput.value = controller.maxLiveTabs;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
