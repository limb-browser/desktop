# Chrome Integration

How Limb integrates with Firefox's browser chrome. This spec covers the DOM structure, bootstrap sequence, and runtime wiring between Limb's tree UI and Firefox's vanilla tabbrowser.

## S1 Foundation

### S1.1 No Zen Dependencies

Limb builds on vanilla Firefox, not Zen Browser. The `src/zen/` directory does not exist. No runtime code may reference `gZenWorkspaces`, `gZenUIManager`, `gZenVerticalTabsManager`, or any other Zen global. The Surfer build tool is used for patch management only.

Any Zen code remaining in the engine's base commit is inert or stubbed. New code must not introduce Zen dependencies.

### S1.2 Minimal Patches

Per patch-strategy.md S1.1: if it can be done in `src/limb/`, do it there. Firefox source patches exist only for:
- DOM structure (S2)
- Bootstrap wiring (S3)
- SessionStore metadata (persistence.md S1.3)
- `about:` page registration

## S2 DOM Structure

### S2.1 browser-box.inc.xhtml Layout

The browser content area has this structure:

```xml
<hbox flex="1" id="browser">
  <html:canvas id="limb-tree-canvas"/>
  <!-- standard Firefox sidebar elements -->
  <html:div id="limb-content-deck">
    <tabbox id="tabbrowser-tabbox" flex="1">
      <tabpanels id="tabbrowser-tabpanels" flex="1"/>
    </tabbox>
  </html:div>
</hbox>
```

The `limb-tree-canvas` and `limb-content-deck` are the only Limb additions to this file.

### S2.2 Canvas Layering

The canvas covers the full window and sits behind all content:

```css
#limb-tree-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  pointer-events: none;
}
```

When zoomed in (focused node fills viewport), the canvas is occluded by the tab content. When zoomed out, the tab content shrinks and the canvas tree becomes visible around it. The canvas never takes up layout space -- it is a visual background layer only.

### S2.3 Content Deck

`limb-content-deck` wraps the tabbrowser and is positioned/scaled by `TabPositioner` based on the focused node's screen coordinates:

```css
#limb-content-deck {
  position: relative;
  z-index: 0;
  flex: 1;
}
```

At zoom level >= 0.9, the content deck fills the viewport (standard browsing). At lower zoom levels, TabPositioner transforms it to show the focused tab at its tree position.

### S2.4 Tab Bar

The Firefox tab bar is hidden. Node creation is the only way to create tabs (tab-bridge.md S4.3):

```css
#tabbrowser-tabs { display: none !important; }
#TabsToolbar { display: none !important; }
```

### S2.5 Address Bar

The nav bar (`#nav-bar`) remains in its standard Firefox position. Its visibility is controlled by `AddressBarAdapter` via CSS custom properties:

```css
#nav-bar {
  opacity: var(--limb-addressbar-opacity, 1);
  pointer-events: var(--limb-addressbar-pointer-events, auto);
  transition: opacity 0.15s ease-out;
}
```

Visibility controlled by `AddressBarAdapter` via CSS custom properties. The address bar fades in over zoom range [0.85, 0.95] per navigation.md S2.1. Below 0.85: hidden (opacity 0, pointer-events none). Above 0.95: fully visible.

## S3 Bootstrap Sequence

### S3.1 browser-init.js onLoad

The `onLoad` handler in `browser-init.js` is patched to initialize Limb after Firefox's standard startup:

```
1. Firefox completes its standard onLoad (tabbrowser ready, SessionStore active)
2. Import Limb modules (LimbTreeView, TabBridge, adapters)
3. Run TreeRestorerAdapter.restoreTreeFromTabs(gBrowser)
   - Reads limb-node-id attributes from restored tabs
   - Rebuilds the BrowsingTree domain model
   - If no tabs exist (fresh profile): creates a root node, opens about:limb-home
4. Initialize LimbTreeView with the canvas element
5. Wire adapters (AddressBar, AutoSave, KeyboardNav, TabBridge, UrlEntry)
6. Attach event listeners
```

### S3.2 Fresh Profile Startup

On a fresh profile with no session to restore:

1. TreeRestorer finds 0 tabs, creates a synthetic root node with URL `about:limb-home`
2. TreeRestorerAdapter creates a real Firefox tab for the root node via `gBrowser.addTrustedTab("about:limb-home")`
3. The tab is selected as `gBrowser.selectedTab`
4. LimbTreeView renders the single-node tree
5. The user sees the launcher page (about:limb-home) at full viewport

### S3.3 Session Restore Startup

On startup with an existing session:

1. Firefox's SessionStore restores tabs with `limb-node-id` attributes
2. TreeRestorer rebuilds the tree from tab metadata
3. TreeRestorerAdapter maps each tree node to its restored tab element
4. The previously focused node's tab becomes `gBrowser.selectedTab`
5. LimbTreeView renders the tree at the last zoom/pan position

## S4 Runtime Wiring

### S4.1 Window Globals

These globals are set on `window` for cross-module access:

| Global | Type | Set by |
|--------|------|--------|
| `gLimbBrowsingTree` | `BrowsingTree` | browser-init.js |
| `gLimbTreeView` | `LimbTreeView` | browser-init.js |
| `gLimbTabBridge` | `TabBridge` | browser-init.js |

### S4.2 Module Loading

All Limb modules are loaded via `ChromeUtils.importESModule` from `chrome://browser/content/limb/...`. They must be `.mjs` files registered in `src/limb/jar.inc.mn`.

No TypeScript at runtime. Firefox cannot load `.ts` files. Use JSDoc for type annotations if needed.

### S4.3 requestAnimationFrame / setInterval

In Firefox's chrome context, bare `requestAnimationFrame` is not bound to `window`. Always use `window.requestAnimationFrame(cb)` explicitly, or pass the function via dependency injection in constructors.

## S5 Build System

### S5.1 File Registration

Every `.mjs`, `.js`, `.css`, and `.html` file in `src/limb/` that Firefox loads at runtime must be listed in `src/limb/jar.inc.mn`:

```
        content/browser/limb/tree/MyModule.mjs    (../../limb/tree/MyModule.mjs)
```

Omitting a file causes `Missing chrome or resource URL` errors at runtime.

### S5.2 Patch Lifecycle

1. Edit the file in `engine/`
2. Run `npm run export -- path/to/file` from the project root
3. The patch file appears in `src/` matching the engine path
4. `npm run import` resets the engine and re-applies all patches

Patches capture diffs against the post-folder-patch engine state. Do not include changes that folder patches already apply.

### S5.3 Zen Stubs

`src/limb/tree/limb-zen-stubs.js` provides no-op globals for Zen references baked into the engine's base commit. If a `gZen*` ReferenceError appears, add the name to this file. Do not guard individual call sites.

Long-term, these stubs go away when the engine base commit is regenerated from clean Firefox source without Zen patches.
