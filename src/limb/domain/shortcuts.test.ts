import { describe, it, expect } from 'vitest';
import { SHORTCUT_MAP, ShortcutAction } from './shortcuts.js';

describe('SHORTCUT_MAP', () => {
  // §4.1 Zoom shortcuts
  const zoomShortcuts: [string, ShortcutAction][] = [
    ['Ctrl+ScrollUp', 'zoom-in'],
    ['Ctrl+ScrollDown', 'zoom-out'],
    ['Ctrl+0', 'zoom-reset'],
    ['Ctrl+1', 'zoom-focus'],
  ];

  // §4.2 Navigation shortcuts
  const navigationShortcuts: [string, ShortcutAction][] = [
    ['Ctrl+Click', 'open-child'],
    ['MiddleClick', 'open-child'],
    ['Click', 'focus-node'],
    ['Ctrl+W', 'close-node'],
    ['Ctrl+L', 'focus-address-bar'],
    ['Escape', 'escape'],
  ];

  // §4.3 Tree navigation shortcuts
  const treeNavShortcuts: [string, ShortcutAction][] = [
    ['Alt+Up', 'focus-parent'],
    ['Alt+Down', 'focus-first-child'],
    ['Alt+Left', 'focus-prev-sibling'],
    ['Alt+Right', 'focus-next-sibling'],
  ];

  // settings.md §4.1 Settings shortcut
  const settingsShortcuts: [string, ShortcutAction][] = [
    ['Ctrl+,', 'toggle-settings'],
  ];

  // sessions.md §3.3 / navigation.md §5.2 Session shortcuts
  const sessionShortcuts: [string, ShortcutAction][] = [
    ['Ctrl+Shift+H', 'return-to-launcher'],
    ['Ctrl+N', 'new-session'],
  ];

  // unified-tree.md §6.1 Search shortcut
  const searchShortcuts: [string, ShortcutAction][] = [
    ['Ctrl+K', 'search'],
  ];

  const allShortcuts = [
    ...zoomShortcuts,
    ...navigationShortcuts,
    ...treeNavShortcuts,
    ...settingsShortcuts,
    ...sessionShortcuts,
    ...searchShortcuts,
  ];

  it('defines all zoom shortcuts from §4.1', () => {
    for (const [key, action] of zoomShortcuts) {
      expect(SHORTCUT_MAP[key]).toBe(action);
    }
  });

  it('defines all navigation shortcuts from §4.2', () => {
    for (const [key, action] of navigationShortcuts) {
      expect(SHORTCUT_MAP[key]).toBe(action);
    }
  });

  it('defines all tree navigation shortcuts from §4.3', () => {
    for (const [key, action] of treeNavShortcuts) {
      expect(SHORTCUT_MAP[key]).toBe(action);
    }
  });

  it('Ctrl+, resolves to toggle-settings (settings.md §4.1)', () => {
    expect(SHORTCUT_MAP['Ctrl+,']).toBe('toggle-settings');
  });

  it('Ctrl+Shift+H resolves to return-to-launcher (sessions.md §3.3)', () => {
    expect(SHORTCUT_MAP['Ctrl+Shift+H']).toBe('return-to-launcher');
  });

  it('Ctrl+N resolves to new-session (navigation.md §5.2)', () => {
    expect(SHORTCUT_MAP['Ctrl+N']).toBe('new-session');
  });

  it('Ctrl+K resolves to search (unified-tree.md §6.1)', () => {
    expect(SHORTCUT_MAP['Ctrl+K']).toBe('search');
  });

  it('has no duplicate key bindings', () => {
    const keys = Object.keys(SHORTCUT_MAP);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });

  it('each action type is reachable', () => {
    const expectedActions: ShortcutAction[] = [
      'zoom-in',
      'zoom-out',
      'zoom-reset',
      'zoom-focus',
      'open-child',
      'focus-node',
      'close-node',
      'focus-address-bar',
      'escape',
      'focus-parent',
      'focus-first-child',
      'focus-prev-sibling',
      'focus-next-sibling',
      'toggle-settings',
      'return-to-launcher',
      'new-session',
      'search',
    ];

    const actualActions = new Set(Object.values(SHORTCUT_MAP));

    for (const action of expectedActions) {
      expect(actualActions.has(action)).toBe(true);
    }
  });

  it('contains exactly the shortcuts from the spec', () => {
    const expectedKeys = allShortcuts.map(([key]) => key);
    const actualKeys = Object.keys(SHORTCUT_MAP);
    expect(actualKeys.sort()).toEqual(expectedKeys.sort());
  });
});
