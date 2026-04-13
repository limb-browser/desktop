---
title: "Implement about:limb-settings page and settings UI"
spec_ref: "settings.md S3"
depends_on:
  - task-021
  - task-025
progress: not-started
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> Settings are accessible via `about:limb-settings` in the address bar. This is a registered `about:` page, like Firefox's own `about:preferences`.
>
> Additionally:
> - Keyboard shortcut `Ctrl+,` navigates to `about:limb-settings`.
> - A gear icon on the launcher page links to settings.
>
> Dark theme matching the tree view aesthetic. Vertically scrollable with labeled sections.
>
> **General**
> - **Homepage**: text input for the home URL.
> - **Max Live Tabs**: number input, range 1-12.
>
> Changes apply immediately. No "save" button.

## Current State

Limb preferences are registered as Firefox prefs (task-021) but there is no UI to view or edit them. No `about:limb-settings` page exists. The launcher page (task-025) has no gear icon linking to settings. Users can only change settings via `about:config`.

## What To Build

1. Register `about:limb-settings` as a Firefox about: page:
   - Create the about: page module in `src/limb/` following Firefox's about: page registration pattern (same pattern as `about:limb-home` from task-025).
   - Register in the component manifest.
2. Implement settings page HTML/CSS/JS:
   - Dark theme matching the tree view aesthetic.
   - Vertically scrollable layout with labeled sections.
   - **General** section:
     - Homepage: text input bound to `limb.home.url` pref.
     - Max Live Tabs: number input (range 1-12) bound to `limb.tree.max-live-tabs` pref.
   - Changes apply immediately via `Services.prefs` on input change events. No save button.
   - Input values reflect current pref values on page load.
3. Register `Ctrl+,` keyboard shortcut to navigate to `about:limb-settings`.
4. Add a gear icon to the launcher page (`about:limb-home`) that links to `about:limb-settings`.
5. Write tests for:
   - `about:limb-settings` page loads successfully.
   - Changing homepage input updates the `limb.home.url` pref value.
   - Changing max live tabs input updates the `limb.tree.max-live-tabs` pref value.
   - Input values reflect current pref values on page load.
   - `Ctrl+,` navigates to the settings page.
   - Gear icon on launcher links to settings.
