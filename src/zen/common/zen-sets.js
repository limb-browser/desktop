// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

document.addEventListener(
  "MozBeforeInitialXULLayout",
  () => {
    // <commandset id="mainCommandSet"> defined in browser-sets.inc
    document
      .getElementById("zenCommandSet")
      // eslint-disable-next-line complexity
      .addEventListener("command", event => {
        switch (event.target.id) {
          case "cmd_zenCopyCurrentURLMarkdown":
            gZenCommonActions.copyCurrentURLAsMarkdownToClipboard();
            break;
          case "cmd_zenCopyCurrentURL":
            gZenCommonActions.copyCurrentURLToClipboard();
            break;
          case "cmd_zenPinnedTabReset":
            gZenPinnedTabManager.resetPinnedTab(gBrowser.selectedTab);
            break;
          case "cmd_zenPinnedTabResetNoTab":
            gZenPinnedTabManager.resetPinnedTab();
            break;
          case "cmd_zenToggleSidebar":
            gZenVerticalTabsManager.toggleExpand();
            break;
          case "cmd_zenOpenZenThemePicker":
            gZenThemePicker.openThemePicker(event);
            break;
          case "cmd_zenToggleTabsOnRight":
            gZenVerticalTabsManager.toggleTabsOnRight();
            break;
          case "cmd_zenReplacePinnedUrlWithCurrent":
            gZenPinnedTabManager.replacePinnedUrlWithCurrent();
            break;
          case "cmd_contextZenAddToEssentials":
            gZenPinnedTabManager.addToEssentials();
            break;
          case "cmd_contextZenRemoveFromEssentials":
            gZenPinnedTabManager.removeEssentials();
            break;
          case "cmd_zenTogglePinTab": {
            const currentTab = gBrowser.selectedTab;
            if (currentTab && !currentTab.hasAttribute("zen-empty-tab")) {
              if (currentTab.pinned) {
                gBrowser.unpinTab(currentTab);
              } else {
                gBrowser.pinTab(currentTab);
              }
            }
            break;
          }
          case "cmd_zenNewNavigatorUnsynced":
            OpenBrowserWindow({ zenSyncedWindow: false });
            break;
          case "cmd_zenDuplicateTab": {
            const selectedTabs = gBrowser.selectedTabs;
            let insertAt = selectedTabs.at(-1)._tPos + 1;
            for (const tab of selectedTabs) {
              gBrowser.duplicateTab(tab, true, { tabIndex: insertAt++ });
            }
            break;
          }
          default:
            break;
        }
      });
  },
  { once: true }
);
