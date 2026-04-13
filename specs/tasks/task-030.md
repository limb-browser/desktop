# Task 030: Settings page (about:limb-settings)

**Spec:** settings.md S1, S2, S3

**Spec excerpt:**

> Settings use Firefox preferences (`Services.prefs`), branch `limb.*`.
> Available settings: `limb.home.url` (string, default about:blank), `limb.tree.max-live-tabs` (int, default 8), `limb.screenshots.retention-days` (int, default 7).
> Accessible via `about:limb-settings`, `Ctrl+,`, gear icon on launcher.
> Dark theme. Vertically scrollable. General section: Homepage (text input), Max Live Tabs (number, 1-12). Changes apply immediately, no save button.

**Depends on:** task-014

**Build context:** Requires `npm run build:ui` + about: page registration.

**Acceptance criteria:**
- `about:limb-settings` registered as Firefox about: page
- Settings page with dark theme, vertical layout
- Homepage setting: text input bound to `limb.home.url` pref
- Max Live Tabs: number input (1-12) bound to `limb.tree.max-live-tabs` pref
- Changes apply immediately via `Services.prefs`
- `Ctrl+,` navigates to settings page
- Prefs defined in YAML under `prefs/`

**Progress:** not-started

**Commits:**
