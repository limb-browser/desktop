import { describe, it, expect } from 'vitest';
import { ScreenshotStore, type Resolution } from './screenshot-store';

function makeBuffer(size: number): Uint8Array {
  return new Uint8Array(size);
}

describe('ScreenshotStore', () => {
  it('stores and retrieves a screenshot by nodeId and resolution', () => {
    const store = new ScreenshotStore();
    const buf = makeBuffer(100);

    store.store('node-1', 'low', buf);

    expect(store.get('node-1', 'low')).toBe(buf);
  });

  it('stores both low-res and high-res for same node', () => {
    const store = new ScreenshotStore();
    const low = makeBuffer(50);
    const high = makeBuffer(200);

    store.store('node-1', 'low', low);
    store.store('node-1', 'high', high);

    expect(store.get('node-1', 'low')).toBe(low);
    expect(store.get('node-1', 'high')).toBe(high);
  });

  it('remove deletes both resolutions', () => {
    const store = new ScreenshotStore();
    store.store('node-1', 'low', makeBuffer(50));
    store.store('node-1', 'high', makeBuffer(200));

    store.remove('node-1');

    expect(store.get('node-1', 'low')).toBeUndefined();
    expect(store.get('node-1', 'high')).toBeUndefined();
  });

  it('totalSize returns sum of all buffer sizes', () => {
    const store = new ScreenshotStore();
    store.store('node-1', 'low', makeBuffer(50));
    store.store('node-1', 'high', makeBuffer(200));
    store.store('node-2', 'low', makeBuffer(75));

    expect(store.totalSize()).toBe(325);
  });

  it('overwriting a screenshot for same nodeId and resolution replaces the old one', () => {
    const store = new ScreenshotStore();
    const first = makeBuffer(100);
    const second = makeBuffer(150);

    store.store('node-1', 'low', first);
    store.store('node-1', 'low', second);

    expect(store.get('node-1', 'low')).toBe(second);
    expect(store.totalSize()).toBe(150);
  });

  it('get returns undefined for non-existent entries', () => {
    const store = new ScreenshotStore();

    expect(store.get('missing', 'low')).toBeUndefined();
  });

  it('totalSize returns 0 when empty', () => {
    const store = new ScreenshotStore();

    expect(store.totalSize()).toBe(0);
  });
});
