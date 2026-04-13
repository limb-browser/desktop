const INTERNAL_PREFIX = 'about::';

const URL_SHORTCUTS: Record<string, string> = {
  settings: 'about::settings',
  home: 'about::home',
  search: 'about::search',
};

export function isInternalUrl(url: string): boolean {
  return url.startsWith(INTERNAL_PREFIX);
}

export function resolveUrlShortcut(input: string): string {
  return URL_SHORTCUTS[input] ?? input;
}

export function parseInternalPageName(url: string): string {
  return url.slice(INTERNAL_PREFIX.length);
}
