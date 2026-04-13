# Task 024: Keyboard shortcuts

**Spec:** navigation.md S4.1, S4.2, S4.3

**Spec excerpt:**

> Zoom: Ctrl+Scroll Up/Down (zoom in/out), Ctrl+0 (fit tree), Ctrl+1 (zoom focused).
> Navigation: Ctrl+Click/Middle-Click (child node), Click tree node (focus+zoom), Ctrl+W (close node), Ctrl+L (address bar), Escape (return focus / zoom to focused).
> Tree navigation: Alt+Up (parent), Alt+Down (first child), Alt+Left (prev sibling), Alt+Right (next sibling). Work at any zoom level; animate to center on new focus if level >= 0.9.

**Depends on:** task-018, task-019, task-022

**Build context:** Requires `npm run build:ui`.

**Acceptance criteria:**
- All keyboard shortcuts from S4.1, S4.2, S4.3 implemented
- Ctrl+W removes focused node from tree (closes tab)
- Escape behavior: address bar focused → return to page; zoomed out → zoom to focused node
- Alt+Arrow tree navigation works at any zoom level
- After Alt+Arrow focus change at level >= 0.9, view animates to new node
- Shortcuts execute within one frame (no debouncing per S7.2)

**Progress:** not-started

**Commits:**
