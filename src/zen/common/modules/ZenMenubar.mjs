// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const WINDOW_SCHEME_PREF = "zen.view.window.scheme";
const WINDOW_SCHEME_MAPPING = {
  dark: 0,
  light: 1,
  auto: 2,
};

export class nsZenMenuBar {
  constructor() {
    window.addEventListener(
      "ZenKeyboardShortcutsReady",
      () => {
        this.#init();
      },
      { once: true }
    );
  }

  #init() {
    this.#initViewMenu();
    this.#initAppMenu();
    this.#hideWindowRestoreMenus();
  }

  #initViewMenu() {
    let appearanceMenu = window.MozXULElement.parseXULToFragment(`
      <menu data-l10n-id="zen-menubar-appearance">
        <menupopup>
          <menuitem data-l10n-id="zen-menubar-appearance-description" disabled="true" />
          <menuitem data-l10n-id="zen-menubar-appearance-auto" data-type="auto" type="radio" checked="true" />
          <menuitem data-l10n-id="zen-menubar-appearance-light" data-type="light" type="radio" />
          <menuitem data-l10n-id="zen-menubar-appearance-dark" data-type="dark" type="radio" />
        </menupopup>
      </menu>`);
    const menu = appearanceMenu.querySelector("menu");
    menu.addEventListener("command", event => {
      const type = event.target.getAttribute("data-type");
      const schemeValue = WINDOW_SCHEME_MAPPING[type];
      Services.prefs.setIntPref(WINDOW_SCHEME_PREF, schemeValue);
    });
    const viewMenu = document.getElementById("view-menu");
    const parentPopup = viewMenu.querySelector("menupopup");
    parentPopup.prepend(document.createXULElement("menuseparator"));
    parentPopup.prepend(menu);

    parentPopup.addEventListener("popupshowing", () => {
      const currentScheme = Services.prefs.getIntPref(WINDOW_SCHEME_PREF);
      for (const [type, value] of Object.entries(WINDOW_SCHEME_MAPPING)) {
        let menuItem = menu.querySelector(`menuitem[data-type="${type}"]`);
        if (value === currentScheme) {
          menuItem.setAttribute("checked", "true");
        } else {
          menuItem.removeAttribute("checked");
        }
      }
    });
  }

  #initAppMenu() {
    const openUnsyncedWindowItem = window.MozXULElement.parseXULToFragment(
      `<toolbarbutton id="appMenu-new-zen-unsynced-window-button"
                class="subviewbutton"
                data-l10n-id="zen-appmenu-new-blank-window"
                key="zen-new-unsynced-window"
                command="cmd_zenNewNavigatorUnsynced"/>`
    ).querySelector("toolbarbutton");
    PanelMultiView.getViewNode(document, "appMenu-new-window-button2").after(
      openUnsyncedWindowItem
    );
    document.getElementById("menu_newNavigator").after(
      window.MozXULElement.parseXULToFragment(`
        <menuitem id="menu_new_zen_unsynced_window"
                class="subviewbutton"
                data-l10n-id="zen-menubar-new-blank-window"
                key="zen-new-unsynced-window"
                command="cmd_zenNewNavigatorUnsynced"/>`)
    );
  }

  #hideWindowRestoreMenus() {
    if (!Services.prefs.getBoolPref("zen.window-sync.enabled", true)) {
      return;
    }
    const itemsToHide = [
      "appMenuRecentlyClosedWindows",
      "historyUndoWindowMenu",
    ];
    for (const id of itemsToHide) {
      const element = PanelMultiView.getViewNode(document, id);
      element.setAttribute("hidden", "true");
    }
  }
}
