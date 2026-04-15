// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { describe, it, expect } from 'vitest';
import { AddressBarAdapter } from './AddressBarAdapter.mjs';

/** Minimal fake for the #nav-bar HTMLElement. */
function createFakeNavBar(): {
  style: { properties: Map<string, string>; setProperty(name: string, value: string): void };
  ownerDocument: { defaultView: { addEventListener: (type: string, fn: EventListener, capture?: boolean) => void; removeEventListener: (type: string, fn: EventListener, capture?: boolean) => void } };
  _listeners: { type: string; fn: EventListener; capture?: boolean }[];
} {
  const listeners: { type: string; fn: EventListener; capture?: boolean }[] = [];
  const properties = new Map<string, string>();
  return {
    style: {
      properties,
      setProperty(name: string, value: string) {
        properties.set(name, value);
      },
    },
    ownerDocument: {
      defaultView: {
        addEventListener(type: string, fn: EventListener, capture?: boolean) {
          listeners.push({ type, fn, capture });
        },
        removeEventListener(type: string, fn: EventListener, capture?: boolean) {
          const idx = listeners.findIndex(
            (l) => l.type === type && l.fn === fn && l.capture === capture,
          );
          if (idx >= 0) listeners.splice(idx, 1);
        },
      },
    },
    _listeners: listeners,
  };
}

/** Minimal fake for LimbTreeView. */
function createFakeTreeView(initialLevel = 0.5) {
  let level = initialLevel;
  return {
    get zoomLevel() {
      return level;
    },
    setZoomLevel(newLevel: number) {
      level = newLevel;
    },
  };
}

function dispatchKeydown(
  navBar: ReturnType<typeof createFakeNavBar>,
  key: string,
  modifiers: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean } = {},
) {
  for (const listener of navBar._listeners) {
    if (listener.type === 'keydown') {
      listener.fn({
        key,
        ctrlKey: modifiers.ctrlKey ?? false,
        altKey: modifiers.altKey ?? false,
        shiftKey: modifiers.shiftKey ?? false,
        metaKey: modifiers.metaKey ?? false,
      } as unknown as Event);
    }
  }
}

describe('AddressBarAdapter', () => {
  describe('CSS custom property updates', () => {
    it('sets opacity and pointer-events when visibility changes', () => {
      const navBar = createFakeNavBar();
      const treeView = createFakeTreeView();
      const adapter = new AddressBarAdapter(navBar as unknown as HTMLElement, treeView);

      // Trigger a zoom change that moves into the fade range
      adapter.zoomProbe.zoomChanged(0.9, 0);

      expect(navBar.style.properties.get('--limb-addressbar-opacity')).toBeDefined();
      const opacity = parseFloat(navBar.style.properties.get('--limb-addressbar-opacity')!);
      expect(opacity).toBeCloseTo(0.5);
      expect(navBar.style.properties.get('--limb-addressbar-pointer-events')).toBe('auto');
    });

    it('sets pointer-events to none when fully hidden', () => {
      const navBar = createFakeNavBar();
      const treeView = createFakeTreeView();
      const adapter = new AddressBarAdapter(navBar as unknown as HTMLElement, treeView);

      adapter.zoomProbe.zoomChanged(0.5, 0);

      expect(navBar.style.properties.get('--limb-addressbar-opacity')).toBe('0');
      expect(navBar.style.properties.get('--limb-addressbar-pointer-events')).toBe('none');
    });

    it('sets full opacity and auto pointer-events when fully visible', () => {
      const navBar = createFakeNavBar();
      const treeView = createFakeTreeView();
      const adapter = new AddressBarAdapter(navBar as unknown as HTMLElement, treeView);

      // Need to first change away from initial state to trigger probe
      adapter.zoomProbe.zoomChanged(0.5, 0);
      adapter.zoomProbe.zoomChanged(1.0, 0);

      expect(navBar.style.properties.get('--limb-addressbar-opacity')).toBe('1');
      expect(navBar.style.properties.get('--limb-addressbar-pointer-events')).toBe('auto');
    });
  });

  describe('Ctrl+L auto-zoom', () => {
    it('auto-zooms to 0.95 when Ctrl+L fires and zoom is below 0.85', () => {
      const navBar = createFakeNavBar();
      const treeView = createFakeTreeView(0.5);
      const adapter = new AddressBarAdapter(navBar as unknown as HTMLElement, treeView);
      adapter.attach();

      dispatchKeydown(navBar, 'l', { ctrlKey: true });

      expect(treeView.zoomLevel).toBe(0.95);
    });

    it('does not auto-zoom when Ctrl+L fires and zoom is at 0.85', () => {
      const navBar = createFakeNavBar();
      const treeView = createFakeTreeView(0.85);
      const adapter = new AddressBarAdapter(navBar as unknown as HTMLElement, treeView);
      adapter.attach();

      dispatchKeydown(navBar, 'l', { ctrlKey: true });

      expect(treeView.zoomLevel).toBe(0.85);
    });

    it('does not auto-zoom when Ctrl+L fires and zoom is above 0.85', () => {
      const navBar = createFakeNavBar();
      const treeView = createFakeTreeView(0.9);
      const adapter = new AddressBarAdapter(navBar as unknown as HTMLElement, treeView);
      adapter.attach();

      dispatchKeydown(navBar, 'l', { ctrlKey: true });

      expect(treeView.zoomLevel).toBe(0.9);
    });

    it('ignores non-Ctrl+L keystrokes', () => {
      const navBar = createFakeNavBar();
      const treeView = createFakeTreeView(0.5);
      const adapter = new AddressBarAdapter(navBar as unknown as HTMLElement, treeView);
      adapter.attach();

      dispatchKeydown(navBar, 'l', {}); // no ctrl
      dispatchKeydown(navBar, 'k', { ctrlKey: true }); // wrong key

      expect(treeView.zoomLevel).toBe(0.5);
    });

    it('ignores Ctrl+L with other modifiers', () => {
      const navBar = createFakeNavBar();
      const treeView = createFakeTreeView(0.5);
      const adapter = new AddressBarAdapter(navBar as unknown as HTMLElement, treeView);
      adapter.attach();

      dispatchKeydown(navBar, 'l', { ctrlKey: true, altKey: true });
      expect(treeView.zoomLevel).toBe(0.5);

      dispatchKeydown(navBar, 'l', { ctrlKey: true, shiftKey: true });
      expect(treeView.zoomLevel).toBe(0.5);

      dispatchKeydown(navBar, 'l', { ctrlKey: true, metaKey: true });
      expect(treeView.zoomLevel).toBe(0.5);
    });
  });

  describe('destroy', () => {
    it('removes the keyboard listener on destroy', () => {
      const navBar = createFakeNavBar();
      const treeView = createFakeTreeView(0.5);
      const adapter = new AddressBarAdapter(navBar as unknown as HTMLElement, treeView);
      adapter.attach();

      expect(navBar._listeners).toHaveLength(1);

      adapter.destroy();

      expect(navBar._listeners).toHaveLength(0);
    });
  });
});
