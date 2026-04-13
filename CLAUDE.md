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
| Domain | `src/limb/domain/` | Pure logic: tree, zoom, LOD, layout. No browser deps. |
| Ports | `src/limb/ports/` | Interfaces for browser integration |
| Tree UI | `src/limb/tree/` | Canvas tree renderer in Firefox chrome context |
| Patches | `src/browser/` | Targeted Firefox source modifications |
| Specs | `specs/` | Product specifications. Source of truth. |

**Key constraint:** `src/limb/domain/` must not import from browser-specific code. It runs in any JS environment.

## Testing

- **Domain tests:** `npx vitest` (pure TS, fast)
- **Browser tests:** `npm test` (Firefox test framework, slow)
- **TDD:** Write the failing test first, then implement.

## Specs

Product specs live in `specs/`. Read `specs/index.md` for the full list. Specs define behavior. Code implements specs. If they disagree, fix the spec first.

## Patches

Firefox patches in `src/browser/` should be minimal. Prefer adding new files in `src/limb/` over modifying Firefox source. Smaller patches mean easier upstream rebases.

To create a patch: modify files in `engine/`, then `npm run export <path>`.
To apply patches: `npm run import`.

## Commit Conventions

- Conventional commits: feat:, fix:, refactor:, test:, chore:, docs:
- One logical change per commit
- Target `dev` branch for PRs
