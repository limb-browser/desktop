---
title: "Register limb.* preferences"
spec_ref: "settings.md S1 S2"
depends_on:
  - task-002
progress: complete
review: "specs/reviews/review-TASK_021-R1.md"
coverage_sections: []
commits: []
---

## Spec Excerpt

> Settings use Firefox preferences (`Services.prefs`), defined in YAML files under `prefs/`. Preference branch: `limb.*`
>
> | Pref key | Type | Default | Description |
> |----------|------|---------|-------------|
> | `limb.home.url` | string | `about:blank` | URL loaded when creating a new branch |
> | `limb.tree.max-live-tabs` | int | 8 | Max tabs at Live LOD tier simultaneously |
> | `limb.screenshots.retention-days` | int | 7 | Branches older than this keep only root screenshot |

## Current State

No `limb.*` preferences exist. Prefs directory has Zen and Firefox YAML files. Zen module removal (task-002) cleaned up some Zen-specific prefs.

## What To Build

1. Create `prefs/limb/limb.yaml` defining:
   - `limb.home.url` (string, default: `about:blank`)
   - `limb.tree.max-live-tabs` (int, default: 8)
   - `limb.screenshots.retention-days` (int, default: 7)
2. Ensure the YAML file follows the existing prefs format used by Surfer build tool.
3. Verify prefs are registered and accessible via `Services.prefs.getStringPref("limb.home.url")` etc.
4. Write a simple test or verification that the preferences are available after build.
