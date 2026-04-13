import { describe, it, expect } from 'vitest';
import { resolveNavigationIntent } from './navigation';
import type { NavigationEvent, NavigationIntent } from './navigation';

describe('resolveNavigationIntent', () => {
  it('Ctrl+click returns branch', () => {
    const event: NavigationEvent = { trigger: 'ctrl-click' };
    expect(resolveNavigationIntent(event)).toBe<NavigationIntent>('branch');
  });

  it('middle-click returns branch', () => {
    const event: NavigationEvent = { trigger: 'middle-click' };
    expect(resolveNavigationIntent(event)).toBe<NavigationIntent>('branch');
  });

  it('regular click returns in-place', () => {
    const event: NavigationEvent = { trigger: 'click' };
    expect(resolveNavigationIntent(event)).toBe<NavigationIntent>('in-place');
  });

  it('window.open() returns branch', () => {
    const event: NavigationEvent = { trigger: 'window-open' };
    expect(resolveNavigationIntent(event)).toBe<NavigationIntent>('branch');
  });

  it('form submission same-page returns in-place', () => {
    const event: NavigationEvent = { trigger: 'form-submission', target: 'same-page' };
    expect(resolveNavigationIntent(event)).toBe<NavigationIntent>('in-place');
  });

  it('form submission new-window returns branch', () => {
    const event: NavigationEvent = { trigger: 'form-submission', target: 'new-window' };
    expect(resolveNavigationIntent(event)).toBe<NavigationIntent>('branch');
  });
});
