# Settings

User-configurable preferences. Uses Firefox's built-in prefs system.

## S1 Storage

Settings use Firefox preferences (`Services.prefs`), defined in YAML files under `prefs/`. This is the standard Zen/Firefox pattern. No custom JSON files.

Preference branch: `limb.*`

## S2 Available Settings

| Pref key | Type | Default | Description |
|----------|------|---------|-------------|
| `limb.home.url` | string | `about:blank` | URL loaded when creating a new branch |
| `limb.tree.max-live-tabs` | int | 8 | Max tabs at Live LOD tier simultaneously |
| `limb.screenshots.retention-days` | int | 7 | Branches older than this keep only root screenshot |

## S3 Settings UI

### S3.1 Access

Settings are accessible via `about:limb-settings` in the address bar. This is a registered `about:` page, like Firefox's own `about:preferences`.

Additionally:
- Keyboard shortcut `Ctrl+,` navigates to `about:limb-settings`.
- A gear icon on the launcher page links to settings.

### S3.2 Layout

Dark theme matching the tree view aesthetic. Vertically scrollable with labeled sections.

**General**
- **Homepage**: text input for the home URL.
- **Max Live Tabs**: number input, range 1-12.

Changes apply immediately. No "save" button.
