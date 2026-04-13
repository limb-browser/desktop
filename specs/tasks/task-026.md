# Task 026: Screenshot capture + storage

**Spec:** tree-rendering.md S3.3; persistence.md S4.1, S4.2

**Spec excerpt:**

> When tab transitions from Live to Screenshot tier: capture screenshot (canvas.drawWindow() or equivalent), store as JPEG.
> Format: low-res 320px wide JPEG q60 (~15-30KB), high-res 1024px wide JPEG q85 (~80-150KB).
> Retention: active branch keeps all, last 7 days keeps all, older keeps branch root only. Eviction runs on startup and hourly.

**Depends on:** task-020

**Build context:** Requires `npm run build:ui`.

**Acceptance criteria:**
- Screenshots captured when a tab transitions from Live to a Screenshot tier
- Two resolutions generated: low-res (320px, q60) and high-res (1024px, q85)
- Screenshots stored and retrievable by node ID
- Canvas renders screenshots for nodes at Screenshot-Low and Screenshot-High tiers
- Retention policy applied: evict old screenshots per rules
- Eviction runs on startup and periodically

**Progress:** not-started

**Commits:**
