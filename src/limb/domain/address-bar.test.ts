import { describe, it, expect } from 'vitest';
import { computeAddressBarOpacity, computeHomeButtonOpacity, resolveUrlEntry } from './address-bar';
import { TreeNode } from '../ports/tree-types';
import { resolveUrlShortcut } from './internal-url';

function makeNode(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id: 'node-1',
    url: 'https://example.com',
    title: 'Example',
    favicon: null,
    parentId: null,
    childIds: [],
    status: 'live',
    createdAt: 1000,
    lastVisitedAt: 1000,
    descendantCount: 0,
    ...overrides,
  };
}

describe('computeAddressBarOpacity', () => {
  it('returns 0.0 at zoom 0.5', () => {
    expect(computeAddressBarOpacity(0.5)).toBe(0.0);
  });

  it('returns 0.0 at zoom 0.84', () => {
    expect(computeAddressBarOpacity(0.84)).toBe(0.0);
  });

  it('returns 0.0 at zoom exactly 0.85 (fade-in starts above this threshold)', () => {
    expect(computeAddressBarOpacity(0.85)).toBe(0.0);
  });

  it('returns interpolated opacity at zoom 0.90 (should be 0.5)', () => {
    expect(computeAddressBarOpacity(0.90)).toBeCloseTo(0.5, 5);
  });

  it('returns 1.0 at zoom 0.95', () => {
    expect(computeAddressBarOpacity(0.95)).toBe(1.0);
  });

  it('returns 1.0 at zoom 1.0', () => {
    expect(computeAddressBarOpacity(1.0)).toBe(1.0);
  });

  it('returns 0.0 at zoom 0.0', () => {
    expect(computeAddressBarOpacity(0.0)).toBe(0.0);
  });

  it('returns linear interpolation at zoom 0.875 (quarter way)', () => {
    expect(computeAddressBarOpacity(0.875)).toBeCloseTo(0.25, 5);
  });
});

describe('computeHomeButtonOpacity', () => {
  it('returns 1.0 at zoom 0.0 (fully visible in tree view)', () => {
    expect(computeHomeButtonOpacity(0.0)).toBe(1.0);
  });

  it('returns 1.0 at zoom 0.5', () => {
    expect(computeHomeButtonOpacity(0.5)).toBe(1.0);
  });

  it('returns 1.0 at zoom 0.75 (fade-out starts above this)', () => {
    expect(computeHomeButtonOpacity(0.75)).toBe(1.0);
  });

  it('returns interpolated opacity at zoom 0.80 (halfway through fade)', () => {
    expect(computeHomeButtonOpacity(0.80)).toBeCloseTo(0.5, 5);
  });

  it('returns 0.0 at zoom 0.85 (fully hidden)', () => {
    expect(computeHomeButtonOpacity(0.85)).toBe(0.0);
  });

  it('returns 0.0 at zoom 1.0 (fully zoomed in)', () => {
    expect(computeHomeButtonOpacity(1.0)).toBe(0.0);
  });

  it('returns linear interpolation at zoom 0.775 (quarter way through fade)', () => {
    expect(computeHomeButtonOpacity(0.775)).toBeCloseTo(0.75, 5);
  });
});

describe('resolveUrlEntry', () => {
  it('returns in-place for fresh node with no children', () => {
    const node = makeNode({ childIds: [], lastVisitedAt: 5000 });
    const nowMs = 9000; // 4 seconds ago, < 5s
    expect(resolveUrlEntry(node, nowMs, 'https://example.com')).toBe('in-place');
  });

  it('returns branch for node with children', () => {
    const node = makeNode({ childIds: ['child-1'], lastVisitedAt: 5000 });
    const nowMs = 6000; // 1 second ago, < 5s, but has children
    expect(resolveUrlEntry(node, nowMs, 'https://example.com')).toBe('branch');
  });

  it('returns branch for node visited more than 5 seconds ago', () => {
    const node = makeNode({ childIds: [], lastVisitedAt: 1000 });
    const nowMs = 7000; // 6 seconds ago, > 5s
    expect(resolveUrlEntry(node, nowMs, 'https://example.com')).toBe('branch');
  });

  it('returns in-place for node visited less than 5 seconds ago with no children', () => {
    const node = makeNode({ childIds: [], lastVisitedAt: 3000 });
    const nowMs = 7000; // 4 seconds ago
    expect(resolveUrlEntry(node, nowMs, 'https://example.com')).toBe('in-place');
  });

  it('returns branch for node visited exactly 5 seconds ago', () => {
    const node = makeNode({ childIds: [], lastVisitedAt: 2000 });
    const nowMs = 7000; // exactly 5 seconds
    expect(resolveUrlEntry(node, nowMs, 'https://example.com')).toBe('branch');
  });

  it('returns branch for node with children even if just visited', () => {
    const node = makeNode({ childIds: ['c1', 'c2'], lastVisitedAt: 6000 });
    const nowMs = 6500; // 0.5 seconds ago, but has children
    expect(resolveUrlEntry(node, nowMs, 'https://example.com')).toBe('branch');
  });

  it('returns in-place for about:: URL regardless of node state', () => {
    const node = makeNode({ childIds: ['c1'], lastVisitedAt: 1000 });
    const nowMs = 90000; // old node with children -- would normally branch
    expect(resolveUrlEntry(node, nowMs, 'about::settings')).toBe('in-place');
  });

  it('returns in-place for about::home URL', () => {
    const node = makeNode({ childIds: ['c1', 'c2'], lastVisitedAt: 1000 });
    const nowMs = 90000;
    expect(resolveUrlEntry(node, nowMs, 'about::home')).toBe('in-place');
  });

  it('returns in-place for about:: URL after shortcut resolution', () => {
    const node = makeNode({ childIds: ['c1'], lastVisitedAt: 1000 });
    const nowMs = 90000;
    const resolved = resolveUrlShortcut('settings'); // -> about::settings
    expect(resolveUrlEntry(node, nowMs, resolved)).toBe('in-place');
  });

  it('returns in-place for about:: with unknown page name', () => {
    const node = makeNode({ childIds: ['c1'], lastVisitedAt: 1000 });
    const nowMs = 90000;
    expect(resolveUrlEntry(node, nowMs, 'about::unknown')).toBe('in-place');
  });
});
