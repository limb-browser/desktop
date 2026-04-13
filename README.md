<!--
   - This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/.
   -->

# Limb Browser

A browser where tabs are replaced by a zoomable tree. Every page is a node. Opening a link branches a child. Zoom out to see the shape of your browsing. Zoom in to read.

Built on Firefox via [Zen Browser](https://github.com/zen-browser/desktop). Full extension support. MPL-2.0.

**Status: Early development. Not yet usable.**

## What makes it different

Most browsers hide your history behind a menu. Limb makes it the primary interface. You don't manage tabs. You navigate a tree.

- Ctrl+click a link: new child node appears in the tree
- Ctrl+scroll: zoom between single-page view and full tree view
- Click any node: zoom into it and start browsing
- Your browsing session is a visible, spatial map

## Building from source

Requires: Python 3, Node.js 21+, Rust, sccache. See [Zen's build docs](https://docs.zen-browser.app/contribute/desktop/building) for platform-specific prerequisites.

```bash
git clone https://github.com/limb-browser/desktop.git
cd desktop
npm install
npm run init     # Downloads Firefox source, applies patches (~30 min)
npm run build    # Full build (~2-4 hours first time)
npm start        # Run it
```

For UI-only changes (JS/CSS), use `npm run build:ui` for fast rebuilds.

## Project structure

```
specs/              Product specs (what we're building)
src/limb/           Limb-specific code
  domain/           Pure logic: tree model, zoom, LOD, layout (no browser deps)
  ports/            Interfaces for browser integration
  tree/             Tree view UI (canvas renderer in Firefox chrome)
src/browser/        Firefox patches
configs/            Platform-specific build configs (mozconfig)
prefs/              Default preferences (YAML)
surfer.json         Brand config for the Surfer build tool
```

## Specs

Product specifications live in `specs/`. They define what the browser should do. Code follows specs, not the reverse. Start with [`specs/vision.md`](specs/vision.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: read the specs, pick an issue, write tests first.

## Upstream

Limb is a fork of [Zen Browser](https://github.com/zen-browser/desktop), which is a fork of [Firefox](https://www.mozilla.org/firefox/). We track upstream Zen for security patches and engine updates. The `upstream` remote points to `zen-browser/desktop`.

## License

[Mozilla Public License 2.0](LICENSE)
