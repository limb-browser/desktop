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
    handleInitialTab() {},
    testingEnabled: false,
    destroy() {},
  },
  _zenStubHandler
);

for (const name of [
  "gZenCommonActions",
  "gZenCompactModeManager",
  "gZenFolders",
  "gZenGlanceManager",
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
