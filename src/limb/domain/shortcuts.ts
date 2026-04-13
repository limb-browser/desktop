export type ShortcutAction =
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'zoom-focus'
  | 'open-child'
  | 'focus-node'
  | 'close-node'
  | 'focus-address-bar'
  | 'escape'
  | 'focus-parent'
  | 'focus-first-child'
  | 'focus-prev-sibling'
  | 'focus-next-sibling'
  | 'toggle-settings'
  | 'return-to-launcher'
  | 'new-session'
  | 'search';

export const SHORTCUT_MAP: Record<string, ShortcutAction> = {
  // §4.1 Zoom
  'Ctrl+ScrollUp': 'zoom-in',
  'Ctrl+ScrollDown': 'zoom-out',
  'Ctrl+0': 'zoom-reset',
  'Ctrl+1': 'zoom-focus',

  // §4.2 Navigation
  'Ctrl+Click': 'open-child',
  'MiddleClick': 'open-child',
  'Click': 'focus-node',
  'Ctrl+W': 'close-node',
  'Ctrl+L': 'focus-address-bar',
  'Escape': 'escape',

  // §4.3 Tree Navigation
  'Alt+Up': 'focus-parent',
  'Alt+Down': 'focus-first-child',
  'Alt+Left': 'focus-prev-sibling',
  'Alt+Right': 'focus-next-sibling',

  // settings.md §4.1 Settings
  'Ctrl+,': 'toggle-settings',

  // sessions.md §3.3 / navigation.md §5.2 Session
  'Ctrl+Shift+H': 'return-to-launcher',
  'Ctrl+N': 'new-session',

  // unified-tree.md §6.1 Search
  'Ctrl+K': 'search',
};
