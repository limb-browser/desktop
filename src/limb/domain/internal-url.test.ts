import { describe, it, expect } from 'vitest';
import { isInternalUrl, resolveUrlShortcut, parseInternalPageName } from './internal-url';

describe('isInternalUrl', () => {
  it('returns true for about::settings', () => {
    expect(isInternalUrl('about::settings')).toBe(true);
  });

  it('returns true for about::home', () => {
    expect(isInternalUrl('about::home')).toBe(true);
  });

  it('returns true for about:: with unknown page name', () => {
    expect(isInternalUrl('about::foo')).toBe(true);
  });

  it('returns true for about:: with empty page name', () => {
    expect(isInternalUrl('about::')).toBe(true);
  });

  it('returns false for standard about:blank', () => {
    expect(isInternalUrl('about:blank')).toBe(false);
  });

  it('returns false for regular http URL', () => {
    expect(isInternalUrl('https://example.com')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isInternalUrl('')).toBe(false);
  });

  it('returns false for about: single colon', () => {
    expect(isInternalUrl('about:settings')).toBe(false);
  });
});

describe('resolveUrlShortcut', () => {
  it('maps settings to about::settings', () => {
    expect(resolveUrlShortcut('settings')).toBe('about::settings');
  });

  it('maps home to about::home', () => {
    expect(resolveUrlShortcut('home')).toBe('about::home');
  });

  it('maps search to about::search', () => {
    expect(resolveUrlShortcut('search')).toBe('about::search');
  });

  it('returns input unchanged for non-shortcut', () => {
    expect(resolveUrlShortcut('https://example.com')).toBe('https://example.com');
  });

  it('returns input unchanged for unknown shortcut', () => {
    expect(resolveUrlShortcut('foobar')).toBe('foobar');
  });

  it('returns input unchanged for about::settings (already full URL)', () => {
    expect(resolveUrlShortcut('about::settings')).toBe('about::settings');
  });

  it('returns empty string unchanged', () => {
    expect(resolveUrlShortcut('')).toBe('');
  });
});

describe('parseInternalPageName', () => {
  it('extracts settings from about::settings', () => {
    expect(parseInternalPageName('about::settings')).toBe('settings');
  });

  it('extracts home from about::home', () => {
    expect(parseInternalPageName('about::home')).toBe('home');
  });

  it('extracts foo from about::foo', () => {
    expect(parseInternalPageName('about::foo')).toBe('foo');
  });

  it('returns empty string from about::', () => {
    expect(parseInternalPageName('about::')).toBe('');
  });
});
