---
title: "Register about:limb-settings and implement settings UI"
spec_ref: "settings.md S3"
depends_on:
  - task-021
  - task-025
progress: ready-for-review
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> Settings are accessible via `about:limb-settings` in the address bar. Registered `about:` page.
> Keyboard shortcut `Ctrl+,` navigates to `about:limb-settings`.
> Gear icon on the launcher page links to settings.
>
> Dark theme matching tree view aesthetic. Vertically scrollable with labeled sections.
>
> General: Homepage text input, Max Live Tabs number input (range 1-12).
> Changes apply immediately. No "save" button.

## Current State

`limb.*` preferences are registered (task-021). `about:limb-home` registration pattern exists (task-025). No settings page exists.

## What To Build

1. Register `about:limb-settings` as a Firefox about: page (same pattern as about:limb-home).
2. Implement settings UI:
   - Dark theme, vertically scrollable.
   - **General** section:
     - "Homepage" — text input bound to `limb.home.url`.
     - "Max Live Tabs" — number input (1-12) bound to `limb.tree.max-live-tabs`.
   - Changes write to Firefox prefs immediately (two-way binding via `Services.prefs`).
3. Register `Ctrl+,` keyboard shortcut to navigate to `about:limb-settings`.
4. Add a gear icon to the launcher page (about:limb-home) linking to settings.
5. Write tests for:
   - about:limb-settings page loads.
   - Changing a setting updates the Firefox pref.
   - Pref values are reflected in the UI on page load.
   - Ctrl+, shortcut navigates to settings.
