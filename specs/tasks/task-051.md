---
title: "Fix address bar visibility thresholds in chrome-integration.md"
spec_ref: "chrome-integration.md S2.5; navigation.md S2.1"
depends_on: []
progress: ready-for-review
review: ""
coverage_sections: []
commits: []
---

## Spec Excerpt

> **chrome-integration.md S2.5 Address Bar:**
> At zoom level >= 0.9 (focused): visible. Below 0.5 (zoomed
> out): hidden. Between: fading.

> **navigation.md S2.1 Visibility:**
> The address bar is visible when zoomLevel >= 0.85. It fades in
> over the range [0.85, 0.95] (opacity 0.0 at 0.85, opacity 1.0
> at 0.95). Below 0.85, no address bar is shown.

## Current State

The implementation in `AddressBarVisibility.mjs` correctly
follows `navigation.md S2.1`:

```js
const FADE_START = 0.85;
const FADE_END = 0.95;
```

`chrome-integration.md S2.5` describes different thresholds
(0.5 and 0.9) that do not match the authoritative product spec
or the implementation. This is a spec inconsistency introduced
when chrome-integration.md was written.

## What To Build

1. Update `chrome-integration.md S2.5` to reference navigation.md
   S2.1's thresholds. Replace:

   > At zoom level >= 0.9 (focused): visible. Below 0.5
   > (zoomed out): hidden. Between: fading.

   With:

   > Visibility controlled by `AddressBarAdapter` via CSS custom
   > properties. The address bar fades in over zoom range
   > [0.85, 0.95] per navigation.md S2.1. Below 0.85: hidden
   > (opacity 0, pointer-events none). Above 0.95: fully visible.

2. No code changes required. Implementation is correct.
