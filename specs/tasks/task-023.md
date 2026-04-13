# Task 023: Address bar integration

**Spec:** navigation.md S2.1, S2.2, S2.3, S2.4

**Spec excerpt:**

> Visibility: address bar visible when zoomLevel >= 0.85. Fades in over [0.85, 0.95].
> Content: focused node's favicon, URL (editable), back/forward, reload.
> URL entry: typing URL + Enter navigates in-place if node has no children and was visited < 5s ago; otherwise creates child node. about:limb-* URLs navigate in-place.
> Ctrl+L focuses address bar and selects all text.

**Depends on:** task-019

**Build context:** Requires `npm run build:ui`.

**Acceptance criteria:**
- Address bar fades in when zoom level crosses 0.85, fully visible at 0.95
- Address bar shows focused node's favicon and URL
- Back/forward/reload buttons work per-node (standard tab history)
- URL entry creates child or navigates in-place based on rules in S2.3
- `about:limb-*` URLs always navigate in-place
- Ctrl+L focuses address bar
- Address bar hidden when zoom level < 0.85

**Progress:** not-started

**Commits:**
