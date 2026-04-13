# Task 034: Screenshot eviction

**Spec:** performance.md S5.1; persistence.md S4.2

**Spec excerpt:**

> If total screenshot memory exceeds 20MB, evict oldest screenshots from culled-tier nodes.
> Retention: active branch keeps all, last 7 days keeps all, older keeps branch root screenshot only.
> Eviction runs on startup and hourly.

**Depends on:** task-026

**Build context:** Requires `npm run build:ui`.

**Acceptance criteria:**
- Screenshot memory tracked (total size in bytes)
- When > 20MB, evict oldest screenshots from culled-tier nodes
- Retention policy: active branch all, < 7 days all, older branch root only
- Eviction runs on startup
- Eviction runs hourly (periodic timer)
- `limb.screenshots.retention-days` pref respected

**Progress:** not-started

**Commits:**
