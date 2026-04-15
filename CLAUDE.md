# Limb Browser

A tree-first browser built as a Firefox fork via Zen Browser. Browsing history IS the visual interface.

## Quick Start

```bash
npm install
npm run init          # Download Firefox source, apply patches
npm run build         # Full build (hours, first time)
npm run build:ui      # JS/CSS only rebuild (seconds)
npm start             # Run the browser
```

## Architecture

Firefox fork using Zen Browser's Surfer build tool. Patches applied on top of Firefox source.

| Layer | Directory | Role |
|---|---|---|
| Tree UI | `src/limb/tree/` | Canvas tree renderer in Firefox chrome context |
| Patches | `src/browser/` | Targeted Firefox source modifications |
| Specs | `specs/` | Product specifications. Source of truth. |

**Important:** An Electron prototype exists at `~/code/scratch/web-mind/` but its code is NOT in this repo. The specs capture the behavior; the implementation should use Firefox's native capabilities (gBrowser, SessionStore, compositor, tab APIs), not Electron patterns.

## Testing

- **Browser tests:** `npm test` (Firefox test framework)
- **TDD:** Write the failing test first, then implement.

## Specs

Product specs live in `specs/`. Read `specs/index.md` for the full list. Specs define behavior. Code implements specs. If they disagree, fix the spec first.

## Build System Rules

### No TypeScript at runtime

Firefox cannot load `.ts` files. All runtime code must be `.mjs` or `.js`. Follow Zen's pattern:

- **Runtime code:** `.mjs` (ES modules) or `.js` (classic scripts) only
- **Type checking:** Use JSDoc `@param`/`@returns` annotations, or put `.d.ts` files in `src/limb/@types/` for editor support
- **Tests:** `.test.ts` files are fine -- they run in the test harness, not Firefox

If you need types for a module, create a `.d.ts` alongside it. Never use `import type`, generics, `: Type` annotations, `implements`, or `readonly` in files that Firefox will load.

### Chrome file registration

Every `.mjs`, `.js`, `.css`, and `.html` file in `src/limb/` that Firefox needs at runtime must be registered in `src/limb/jar.inc.mn`. Format:

```
        content/browser/limb/tree/MyModule.mjs    (../../limb/tree/MyModule.mjs)
```

After adding a file, also add it to `jar.inc.mn` or it won't be available at `chrome://browser/content/limb/...`.

### Removed Zen modules

Task-002 removed several Zen modules (Workspaces, Compact Mode, Split View, etc.). `src/limb/tree/limb-zen-stubs.js` provides no-op stubs for their globals (`gZenWorkspaces`, `gZenUIManager`, etc.) so remaining Zen code doesn't crash. If you encounter a `gZen*` ReferenceError, add the global name to the stubs file rather than guarding each call site.

### Patches

Firefox patches in `src/browser/` should be minimal. Prefer adding new files in `src/limb/` over modifying Firefox source. Smaller patches mean easier upstream rebases.

Patches are diffs against the **post-folder-patch** engine state (after Zen's directories are copied in). Do not capture Zen's own changes in a git patch -- those are already applied by folder patches.

To create a patch: modify files in `engine/`, then `npm run export <path>`.
To apply patches: `npm run import`.

## Commit Conventions

- Conventional commits: feat:, fix:, refactor:, test:, chore:, docs:
- One logical change per commit
- Target `dev` branch for PRs
