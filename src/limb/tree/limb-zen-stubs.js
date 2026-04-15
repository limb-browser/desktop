// Stubs for removed Zen modules.
// Limb replaces Zen's workspace/tab management with its tree model.
// These no-op stubs prevent ReferenceErrors in remaining Zen code paths.

const _zenStubHandler = {
  get(target, prop) {
    if (prop === Symbol.toPrimitive) return () => "";
    if (prop === "then") return undefined; // not thenable
    return typeof target[prop] === "function"
      ? target[prop]
      : () => undefined;
  },
};

const _zenStub = new Proxy(
  {
    handleNewTab() { return false; },
    handleTabCloseWindow() {},
    selectStartPage() {},
    activeWorkspaceElement: null,
    activeWorkspaceStrip: null,
    privateWindowOrDisabled: true,
    workspaceElement() { return null; },
    getEssentialsSection() { return document.createDocumentFragment(); },
    getContextIdIfNeeded(userContextId) { return [userContextId, false, undefined]; },
    handleInitialTab() {},
    testingEnabled: false,
    shouldCloseTabOnBack() { return false; },
    destroy() {},
  },
  _zenStubHandler
);

for (const name of [
  "gZenCommonActions",
  "gZenCompactModeManager",
  "gZenFolders",
  "gZenGlanceManager",
  "gZenMediaController",
  "gZenPinnedTabManager",
  "gZenSessionStore",
  "gZenSiteDataPanel",
  "gZenUIManager",
  "gZenVerticalTabsManager",
  "gZenViewSplitter",
  "gZenWindowSync",
  "gZenWorkspaces",
]) {
  if (typeof globalThis[name] === "undefined") {
    globalThis[name] = _zenStub;
  }
}

// Zen's session manager restores 0 tabs after migration (no zen_workspaces
// table), leaving selectedTab undefined and the screen blank. Ensure at
// least one tab exists after startup completes.
if (typeof Services !== "undefined") {
  Services.obs.addObserver({
    observe() {
      Services.obs.removeObserver(this, "browser-delayed-startup-finished");
      if (typeof gBrowser !== "undefined" && !gBrowser.selectedTab) {
        gBrowser.addTrustedTab("about:blank");
      }
    },
  }, "browser-delayed-startup-finished");
}
