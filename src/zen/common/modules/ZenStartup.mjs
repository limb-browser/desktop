// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

class ZenStartup {
  #watermarkIgnoreElements = ["zen-toast-container"];
  #hasInitializedLayout = false;

  isReady = false;
  promiseInitialized = new Promise(resolve => {
    this.promiseInitializedResolve = resolve;
  });

  init() {
    this.openWatermark();
    this.#changeSidebarLocation();
    this.#zenInitBrowserLayout();
  }

  get #shouldUseWatermark() {
    return Services.prefs.getBoolPref("zen.watermark.enabled", false);
  }

  #zenInitBrowserLayout() {
    if (this.#hasInitializedLayout) {
      return;
    }
    this.#hasInitializedLayout = true;
    gZenKeyboardShortcutsManager.beforeInit();
    try {
      const kNavbarItems = ["nav-bar", "PersonalToolbar"];
      const kNewContainerId = "zen-appcontent-navbar-container";
      let newContainer = document.getElementById(kNewContainerId);
      for (let id of kNavbarItems) {
        const node = document.getElementById(id);
        if (!node) {
          console.error("Could not find node with id: " + id);
          continue;
        }
        newContainer.appendChild(node);
      }
      // Fix notification deck
      const deckTemplate =
        document.getElementById("tab-notification-deck-template") ||
        document.getElementById("tab-notification-deck");

      // overlap and interaction issues with vertical tabs
      document.getElementById("browser").prepend(deckTemplate);

      setTimeout(() => {
        gZenUIManager.init();
      }, 0);
    } catch (e) {
      console.error("ZenThemeModifier: Error initializing browser layout", e);
    }
    if (gBrowserInit.delayedStartupFinished) {
      this.delayedStartupFinished();
    } else {
      Services.obs.addObserver(this, "browser-delayed-startup-finished");
    }
  }

  observe(aSubject, aTopic) {
    // This nsIObserver method allows us to defer initialization until after
    // this window has finished painting and starting up.
    if (aTopic == "browser-delayed-startup-finished" && aSubject == window) {
      Services.obs.removeObserver(this, "browser-delayed-startup-finished");
      this.delayedStartupFinished();
    }
  }

  async delayedStartupFinished() {
    await delayedStartupPromise;
    await SessionStore.promiseAllWindowsRestored;
    delete gZenUIManager.promiseInitialized;
    // Fix for https://github.com/zen-browser/desktop/issues/7605
    if (gURLBar.hasAttribute("breakout-extend")) {
      gURLBar.focus();
    }
    // A bit of a hack to make sure the tabs toolbar is updated.
    // Just in case we didn't get the right size.
    gZenUIManager.updateTabsToolbar();
    this.closeWatermark();
    document
      .getElementById("tabbrowser-arrowscrollbox")
      .setAttribute("orient", "vertical");
    this.isReady = true;
    this.promiseInitializedResolve();
    delete this.promiseInitializedResolve;
  }

  openWatermark() {
    if (!this.#shouldUseWatermark) {
      document.documentElement.removeAttribute("zen-before-loaded");
      return;
    }
    for (let elem of document.querySelectorAll("#browser > *, #urlbar")) {
      elem.style.opacity = 0;
    }
  }

  closeWatermark() {
    document.documentElement.removeAttribute("zen-before-loaded");
    if (this.#shouldUseWatermark) {
      let elementsToIgnore = this.#watermarkIgnoreElements
        .map(id => "#" + id)
        .join(", ");
      gZenUIManager.motion
        .animate(
          "#browser > *:not(" +
            elementsToIgnore +
            "), #urlbar, #tabbrowser-tabbox > *",
          {
            opacity: [0, 1],
          },
          {
            duration: 0.1,
          }
        )
        .then(() => {
          for (let elem of document.querySelectorAll(
            "#browser > *, #urlbar, #tabbrowser-tabbox > *"
          )) {
            elem.style.removeProperty("opacity");
          }
        });
    }
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new window.Event("resize")); // To recalculate the layout
    });
  }

  #changeSidebarLocation() {
    const kElementsToAppend = ["sidebar-splitter", "sidebar-box"];

    const browser = document.getElementById("browser");
    browser.prepend(gNavToolbox);

    const sidebarPanelWrapper = document.getElementById("tabbrowser-tabbox");
    for (let id of kElementsToAppend) {
      const elem = document.getElementById(id);
      if (elem) {
        sidebarPanelWrapper.prepend(elem);
      }
    }
  }

}

window.gZenStartup = new ZenStartup();

window.addEventListener(
  "MozBeforeInitialXULLayout",
  () => {
    gZenStartup.init();
  },
  { once: true }
);
