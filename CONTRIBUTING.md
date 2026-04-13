<!--
   - This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/.
   -->

# Contributing to Limb

## Getting started

1. Read [`specs/vision.md`](specs/vision.md) to understand what Limb is.
2. Check [open issues](https://github.com/limb-browser/desktop/issues) for something to work on.
3. Follow the build instructions in [README.md](README.md).

## Development approach

We use spec-driven development. Specs define what the browser should do. Code implements specs. If a spec is wrong, fix the spec first, then the code.

### Test-driven development

Write the failing test before the implementation. Domain logic (`src/limb/domain/`) is pure TypeScript with no browser dependencies, tested with vitest. Browser integration code is tested via Firefox's built-in test framework.

### Commit conventions

Use [conventional commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `refactor:` code change that doesn't add a feature or fix a bug
- `test:` adding or updating tests
- `docs:` documentation changes
- `chore:` build, CI, dependency updates

One logical change per commit.

### Pull requests

- Keep PRs focused. One feature or fix per PR.
- Reference the relevant spec section if applicable.
- Include a test plan in the PR description.
- Target the `dev` branch.

## Architecture

Limb inherits Zen's patch-based architecture on top of Firefox. Custom code lives in `src/limb/`. See `specs/patch-strategy.md` for details on which Firefox files we patch and why.

### Domain layer (`src/limb/domain/`)

Pure business logic. Tree model, zoom math, layout algorithms, LOD computation. No browser dependencies. This code can run in any JS environment and is tested with vitest.

### Ports (`src/limb/ports/`)

Interfaces that the domain layer uses to interact with the browser. Implementations live in the browser chrome layer.

### Tree view (`src/limb/tree/`)

The canvas-based tree renderer that replaces the traditional tab bar. This runs in Firefox's chrome context and integrates with the domain layer.

### Firefox patches (`src/browser/`)

Minimal, targeted patches to Firefox source files. Each patch should be as small as possible to ease upstream rebases.

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
